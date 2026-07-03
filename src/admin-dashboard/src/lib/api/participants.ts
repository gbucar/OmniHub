import { pgClient } from './client';
import type { Participant, Study } from './types';

type RawParticipantRow = {
	user_id: string;
	username: string | null;
	role: string | null;
	properties: Record<string, unknown> | null;
	study_name: string | null;
	study_id: number | null;
};

/**
 * `api.list_participants` is a SQL view that joins `data.participants` to
 * `data.many_participants_studies`, so a participant belonging to N studies
 * appears in N rows. The UI wants one row per user, with all their studies
 * collected into a `studies: Study[]` array — so we de-duplicate here and
 * also re-implement the search/filter/limit/offset semantics on the
 * de-duplicated set.
 */
export const getParticipants = async (filters?: {
	search?: string;
	study?: string;
	limit?: number;
	offset?: number;
}) => {
	const data = await pgClient?.from('list_participants').select('*');
	const rawRows = (data?.data ?? []) as RawParticipantRow[];

	// 1. Group raw rows by user_id, collecting all (study_id, study_name) pairs.
	const byUser = new Map<string, RawParticipantRow & { studies: Study[] }>();
	for (const row of rawRows) {
		const existing = byUser.get(row.user_id);
		if (existing) {
			if (row.study_id != null && row.study_name != null) {
				existing.studies.push({ id: row.study_id, name: row.study_name });
			}
		} else {
			byUser.set(row.user_id, {
				...row,
				studies:
					row.study_id != null && row.study_name != null
						? [{ id: row.study_id, name: row.study_name }]
						: []
			});
		}
	}

	let participants: Participant[] = Array.from(byUser.values()).map((u) => ({
		user_id: u.user_id,
		username: u.username,
		role: u.role,
		properties: u.properties,
		// Derive the free-text `type` classification from properties->>'type'.
		// The DB doesn't have a dedicated column — we read/write it via
		// the `properties` jsonb so no migration is required.
		type:
			u.properties && typeof u.properties.type === 'string' && u.properties.type.length > 0
				? u.properties.type
				: null,
		studies: u.studies,
		// Deprecated single-study fields — first study or null.
		study_name: u.studies[0]?.name ?? null,
		study_id: u.studies[0]?.id ?? null
	}));

	// 2. Apply search filter (case-insensitive over username and properties.name).
	if (filters?.search) {
		const needle = filters.search.toLowerCase();
		participants = participants.filter((p) => {
			if (p.username?.toLowerCase().includes(needle)) return true;
			const name = p.properties?.name;
			if (typeof name === 'string' && name.toLowerCase().includes(needle)) return true;
			return false;
		});
	}

	// 3. Apply study filter (participants must be a member of the chosen study).
	if (filters?.study && filters.study !== 'all') {
		const wantedStudyId = parseInt(filters.study);
		participants = participants.filter((p) => p.studies.some((s) => s.id === wantedStudyId));
	}

	const count = participants.length;

	// 4. Apply pagination.
	const offset = filters?.offset ?? 0;
	const limit = filters?.limit ?? 10;
	participants = participants.slice(offset, offset + limit);

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
