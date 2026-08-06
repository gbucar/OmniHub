import { pgClient } from './client';
import type { Participant, Study } from './types';

type ParticipantRow = {
	user_id: string;
	username: string | null;
	role: string | null;
	properties: Record<string, unknown> | null;
	/** JSON array of { id, name } objects — one per study the participant belongs to. */
	studies: Study[] | string | null;
	study_name: string | null;
	study_id: number | null;
	sys_created_at?: string | null;
	sys_changed_at?: string | null;
};

/**
 * Fetch participants with server-side search and pagination.
 *
 * The view `api.list_participants` (migration 21) returns one row per user
 * with studies aggregated into a JSON array, so `range()` + `count: 'exact'`
 * work correctly at the database level — no client-side de-duplication needed.
 *
 * Study filtering is applied client-side on the already-parsed studies array
 * because the view's `MIN(study_id)` is not reliable for membership checks.
 */
export const getParticipants = async (filters?: {
	search?: string;
	study?: string;
	limit?: number;
	offset?: number;
}) => {
	let query = pgClient?.from('list_participants').select('*', { count: 'exact' });

	// ── Server-side search ────────────────────────────────────────────
	if (filters?.search) {
		const s = filters.search;
		query = query?.or(
			`username.ilike.*${s}*,properties->>name.ilike.*${s}*`
		);
	}

	// ── Server-side pagination ────────────────────────────────────────
	if (filters?.limit !== undefined && filters?.offset !== undefined) {
		query = query?.range(
			filters.offset,
			filters.offset + filters.limit - 1
		);
	}

	const data = await query;
	const rawRows = (data?.data ?? []) as ParticipantRow[];
	const count = data?.count ?? 0;

	// ── Parse studies JSON ────────────────────────────────────────────
	let participants: Participant[] = rawRows.map((row) => {
		let studies: Study[] = [];
		if (row.studies) {
			try {
				studies = typeof row.studies === 'string'
					? JSON.parse(row.studies)
					: (row.studies as unknown as Study[]);
			} catch {
				studies = [];
			}
		}
		return {
			user_id: row.user_id,
			username: row.username,
			role: row.role,
			properties: row.properties,
			sys_created_at: row.sys_created_at ?? null,
			type:
				row.properties && typeof row.properties.type === 'string' && row.properties.type.length > 0
					? row.properties.type
					: null,
			studies,
			study_name: studies[0]?.name ?? null,
			study_id: studies[0]?.id ?? null
		};
	});

	// ── Client-side study filter ──────────────────────────────────────
	// Applied after parsing because MIN(study_id) in the view is not
	// reliable for membership checks.
	if (filters?.study && filters.study !== 'all') {
		const wantedStudyId = parseInt(filters.study);
		participants = participants.filter((p) =>
			p.studies.some((s) => s.id === wantedStudyId)
		);
	}

	return { data: participants, count };
};

export const addParticipant = async (participant: {
	username: string;
	password: string;
	properties: Record<string, unknown>;
}) => {
	const data = await pgClient?.schema('api').rpc('add_participant', {
		username: participant.username,
		password: participant.password,
		properties: participant.properties
	});
	if (data?.error) {
		throw new Error(data.error.message);
	}
	return data?.data ?? null;
};

export const updateParticipant = async (participant: {
	user_id: string;
	properties: Record<string, unknown>;
}) => {
	const data = await pgClient
		?.from('participants')
		.update({
			properties: participant.properties
		})
		.eq('user_id', participant.user_id);
	if (data?.error) {
		throw new Error(data.error.message);
	}
	return data?.data ?? null;
};

/**
 * Resolve the `user_id` (uuid) for a given username.
 *
 * The `api.add_participant` RPC returns `void`, so after calling it we
 * don't have the freshly-inserted user id. We use the `api.list_participants`
 * view — which is exposed to PostgREST and joins `auth.users` ↔
 * `data.participants` — to look up the id by username. Returns `null` if
 * the username does not exist (should never happen right after
 * `addParticipant` succeeds, but a defensive `null` is friendlier than a
 * thrown error in a bulk-import loop).
 *
 * Implementation note: the view is the same one `getParticipants` reads
 * from, so the RLS policy chain is identical (`allow_admin_select_user_data`
 * + `allow_admin_researcher_select_all_participants`).
 */
export const lookupUserIdByUsername = async (username: string): Promise<string | null> => {
	const data = await pgClient
		?.from('list_participants')
		.select('user_id')
		.eq('username', username)
		.limit(1);
	if (data?.error) {
		throw new Error(data.error.message);
	}
	const rows = (data?.data ?? []) as Array<{ user_id: string }>;
	return rows[0]?.user_id ?? null;
};

/**
 * Add a participant and return the freshly-created `user_id`. Composed
 * from `addParticipant` + a single username lookup. Used by the bulk
 * upload flow which needs the id to attach the user to a study and to
 * device ownerships.
 *
 * The existing `addParticipant` signature is unchanged (other callers
 * still get `void` / `null` back); bulk upload uses this higher-level
 * helper instead.
 */
export const addParticipantAndReturnId = async (participant: {
	username: string;
	password: string;
	properties: Record<string, unknown>;
}): Promise<string> => {
	await addParticipant(participant);
	const userId = await lookupUserIdByUsername(participant.username);
	if (!userId) {
		throw new Error(`User "${participant.username}" was created but could not be looked up`);
	}
	return userId;
};
