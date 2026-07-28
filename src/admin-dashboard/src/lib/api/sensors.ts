import { pgClient } from './client';
import type { Sensor, Ownership, DataStream, SensorOwnership, RecentObservation } from './types';

export interface SensorFilters {
	search?: string;
	sensorType?: string;
	status?: string;
	limit?: number;
	offset?: number;
}

export interface PaginatedResult<T> {
	data: T[];
	count: number;
}

/**
 * Fetch sensors with server-side filtering, search, and pagination.
 *
 * All filtering is pushed to the database via PostgREST query parameters:
 *   - search: uses `or` with `ilike` across name, description, and known
 *     JSONB property keys (atmotube_id, internal_id).
 *   - sensorType: exact match on `sensor_type` column.
 *   - status: `properties->>status` eq/is.null for "unknown".
 *
 * Pagination is handled via PostgREST's Range header, with `count=exact`
 * so the caller can compute total pages without a separate query.
 */
export const getSensors = async (filters?: SensorFilters): Promise<PaginatedResult<Sensor>> => {
	let query = pgClient?.from('list_sensors').select('*', { count: 'exact' });

	// ── Search (OR across multiple columns) ──────────────────────────
	if (filters?.search) {
		const s = filters.search;
		query = query?.or(
			[
				`name.ilike.*${s}*`,
				`description.ilike.*${s}*`,
				`properties->>atmotube_id.ilike.*${s}*`,
				`properties->>internal_id.ilike.*${s}*`
			].join(',')
		);
	}

	// ── Sensor type filter ────────────────────────────────────────────
	if (filters?.sensorType && filters.sensorType !== 'all') {
		query = query?.eq('sensor_type', filters.sensorType);
	}

	// ── Status filter ─────────────────────────────────────────────────
	if (filters?.status && filters.status !== 'all') {
		if (filters.status === 'unknown') {
			query = query?.is('properties->>status', null);
		} else {
			query = query?.eq('properties->>status', filters.status);
		}
	}

	// ── Pagination ────────────────────────────────────────────────────
	if (filters?.limit !== undefined && filters?.offset !== undefined) {
		query = query?.range(filters.offset, filters.offset + filters.limit - 1);
	}

	const data = await query;
	return {
		data: (data?.data ?? []) as Sensor[],
		count: data?.count ?? 0
	};
};

/**
 * Fetch all distinct sensor types from the database.
 * Used to populate the sensor type filter dropdown.
 */
export const getSensorTypes = async (): Promise<string[]> => {
	const data = await pgClient?.from('list_sensors').select('sensor_type');
	const rows = (data?.data ?? []) as { sensor_type: string }[];
	return Array.from(new Set(rows.map((r) => r.sensor_type).filter(Boolean)));
};

/**
 * Fetch all ownerships belonging to a user, joined with the owned sensor.
 *
 * Implementation note: PostgREST resource embedding across views
 * (`api.ownerships` -> `api.list_sensors`) does not work reliably because
 * there is no discoverable foreign-key relationship between the two views
 * in pg_catalog — the embedded `list_sensors` always comes back as null,
 * which the UI then renders as "Unknown". We work around this by issuing
 * two independent queries and joining client-side on `sensor_id`. The
 * result is equivalent to a LEFT JOIN. This mirrors the pattern already
 * used by `getParticipants` (which fetches `list_participants` flat and
 * groups by user_id client-side).
 */
export const getUserOwnerships = async (userId: string): Promise<Ownership[]> => {
	const [ownershipsRes, sensorsRes] = await Promise.all([
		pgClient?.from('ownerships').select('*').eq('user_id', userId),
		pgClient?.from('list_sensors').select('*')
	]);

	const sensors = (sensorsRes?.data ?? []) as Sensor[];
	const sensorsById = new Map<number, Sensor>(sensors.map((s) => [s.id, s]));

	const raw = (ownershipsRes?.data ?? []) as Array<{
		user_id: string;
		sensor_id: number;
		start_date: string;
		end_date: string;
		sys_created_at?: string;
	}>;

	return raw.map((item) => ({
		user_id: item.user_id,
		sensor_id: item.sensor_id,
		start_date: item.start_date,
		end_date: item.end_date,
		sys_created_at: item.sys_created_at,
		list_sensors: sensorsById.get(item.sensor_id)
	}));
};

export const addOwnership = async (ownership: {
	user_id: string;
	sensor_id: number;
	start_date: string;
	end_date: string;
}) => {
	const data = await pgClient?.from('ownerships').insert(ownership);
	if (data?.error) {
		throw new Error(data.error.message);
	}
	return data?.data ?? null;
};

/**
 * Update the validity dates of an existing ownership.
 *
 * The `data.ownerships` primary key includes `start_date` and `end_date`,
 * so this performs an UPDATE with a WHERE clause pinning the OLD dates.
 * If a row with the new (user_id, sensor_id, start_date, end_date) tuple
 * already exists, Postgres returns a unique_violation (PostgREST code
 * 23505) which is surfaced as an Error here — that is the signal that
 * "an ownership with these new dates already exists for this device".
 *
 * Uses the existing admin UPDATE RLS policy on `data.ownerships`.
 */
export const updateOwnership = async (
	userId: string,
	sensorId: number,
	oldStartDate: string,
	oldEndDate: string,
	newStartDate: string,
	newEndDate: string
) => {
	const data = await pgClient
		?.from('ownerships')
		.update({ start_date: newStartDate, end_date: newEndDate })
		.eq('user_id', userId)
		.eq('sensor_id', sensorId)
		.eq('start_date', oldStartDate)
		.eq('end_date', oldEndDate);

	if (data?.error) {
		throw new Error(data.error.message);
	}

	// If no row matched the WHERE clause, the original ownership may have
	// been changed concurrently — treat as failure.
	if (Array.isArray(data?.data) && (data.data as unknown[]).length === 0) {
		throw new Error('Original ownership no longer exists; refresh the panel and try again');
	}

	return data?.data ?? null;
};

/**
 * "Remove" an ownership without deleting the row.
 * Implemented as a soft delete: set end_date to a date in the distant past
 * so the PeriodBadge displays "Inactive" and the assignment is effectively
 * hidden from active use. Uses the existing admin UPDATE RLS policy — no
 * DELETE needed and no new RLS policies required.
 */
export const removeOwnership = async (
	userId: string,
	sensorId: number,
	startDate: string,
	endDate: string
) => {
	const REMOVED_END_DATE = '2000-01-01 00:00:00+00';
	const data = await pgClient
		?.from('ownerships')
		.update({ end_date: REMOVED_END_DATE })
		.eq('user_id', userId)
		.eq('sensor_id', sensorId)
		.eq('start_date', startDate)
		.eq('end_date', endDate);
	if (data?.error) {
		throw new Error(data.error.message);
	}
	return data?.data ?? null;
};

/**
 * Update sensor fields. Uses the existing RLS policy
 * `allow_admin_update_all_sensors` on `data.sensors`.
 *
 * Pass only the fields you want to change — undefined values are forwarded
 * to PostgREST which will set the column to NULL. If you want to keep
 * something untouched, omit it from the `changes` object.
 */
export const updateSensor = async (id: number, changes: Partial<Sensor>): Promise<void> => {
	// Strip read-only / server-managed fields so the caller can't overwrite them.
	const { id: _id, sys_created_at: _created, last_activity: _last, ...patch } = changes;
	void _id;
	void _created;
	void _last;

	const data = await pgClient?.from('sensors').update(patch).eq('id', id);
	if (data?.error) {
		throw new Error(data.error.message);
	}
};

/**
 * Fetch all data streams belonging to a sensor. Uses the existing RLS
 * policy `allow_admin_researcher_pipeline_select_all_datastream`.
 */
export const getSensorStreams = async (sensorId: number): Promise<DataStream[]> => {
	const data = await pgClient
		?.from('data_streams')
		.select('id, sensor_id, name, description, unit_of_measurement, properties')
		.eq('sensor_id', sensorId);
	return (data?.data ?? []) as DataStream[];
};

/**
 * Fetch all ownerships of a sensor, joined with the owning user's username
 * and the participant's display name (read from `data.participants.properties->>'name'`).
 *
 * Implementation note: PostgREST resource embedding across views does not
 * work reliably (no discoverable FK between `api.ownerships` and
 * `auth.users` / `api.participants`), so the embedded `users` and
 * `participants` always came back as null — which is why the Devices page
 * showed "no ownerships" even though every user had at least one. We work
 * around this by issuing two independent queries and joining client-side
 * on `user_id`. The result is equivalent to a LEFT JOIN. Single round-trip
 * per source set, joined in memory — O(1) network requests, not N+1.
 *
 * We use the existing `api.list_participants` view (which already JOINs
 * `auth.users` + `data.participants` + `data.many_participants_studies`)
 * as the source for `username` + `properties.name`. This avoids hitting
 * the `auth` schema directly (which isn't exposed via `PGRST_DB_SCHEMAS`)
 * and avoids the `api.users` view that the PostgREST layer doesn't expose.
 *
 * Uses the existing RLS policies:
 *   - `allow_admin_researcher_select_all_ownerships`
 *   - `allow_admin_select_user_data` (via list_participants -> auth.users)
 *   - `allow_admin_researcher_select_all_participants` (via list_participants)
 */
export const getSensorOwnerships = async (sensorId: number): Promise<SensorOwnership[]> => {
	const [ownershipsRes, participantsRes] = await Promise.all([
		pgClient?.from('ownerships').select('*').eq('sensor_id', sensorId),
		pgClient?.from('list_participants').select('user_id, username, properties')
	]);

	const participantsById = new Map<
		string,
		{ user_id: string; username: string | null; properties: Record<string, unknown> | null }
	>(
		(
			(participantsRes?.data ?? []) as {
				user_id: string;
				username: string | null;
				properties: Record<string, unknown> | null;
			}[]
		).map((p) => [p.user_id, p])
	);

	const raw = (ownershipsRes?.data ?? []) as Array<{
		user_id: string;
		sensor_id: number;
		start_date: string;
		end_date: string;
		sys_created_at?: string;
	}>;

	return raw.map((item) => {
		const participant = participantsById.get(item.user_id);
		const participantName =
			participant?.properties && typeof participant.properties.name === 'string'
				? (participant.properties.name as string)
				: null;

		return {
			user_id: item.user_id,
			sensor_id: item.sensor_id,
			start_date: item.start_date,
			end_date: item.end_date,
			sys_created_at: item.sys_created_at,
			username: participant?.username ?? null,
			participant_name: participantName
		};
	});
};

/**
 * Fetch the most recent N observations for a sensor (across all its data
 * streams). Joins observations -> data_streams -> locations and returns a
 * compact representation suitable for the device details sidebar.
 *
 * Uses the existing RLS policies:
 *   - `allow_admin_researcher_pipeline_select_all_observations`
 *   - `allow_admin_researcher_pipeline_select_all_locations`
 *   - `allow_admin_researcher_pipeline_select_all_datastream`
 *
 * The location is derived as `properties->>'city'` (or null) and then
 * post-processed into a short "City" string. PostgREST can't extract a
 * JSONB field in a single SELECT, so we read the whole `properties` object
 * and resolve the city client-side.
 */
export const getRecentObservations = async (
	sensorId: number,
	limit: number = 20
): Promise<RecentObservation[]> => {
	const data = await pgClient
		?.from('observations')
		.select(
			`
				id,
				data_stream_id,
				phenomenon_time,
				result,
				data_streams!inner (
					id,
					sensor_id,
					name
				),
				locations (
					properties
				)
			`
		)
		.eq('data_streams.sensor_id', sensorId)
		.order('phenomenon_time', { ascending: false })
		.limit(limit);

	const raw = (data?.data ?? []) as Record<string, unknown>[];
	return raw.map((item) => {
		const ds = item.data_streams as { id: number; name: string } | null;
		const loc = item.locations as
			| { properties: Record<string, unknown> | null }
			| { properties: Record<string, unknown> | null }[]
			| null;
		const locProps = Array.isArray(loc) ? (loc[0]?.properties ?? null) : (loc?.properties ?? null);
		const city = locProps && typeof locProps.city === 'string' ? (locProps.city as string) : null;

		return {
			id: item.id as number,
			data_stream_id: item.data_stream_id as number,
			data_stream_name: ds?.name ?? '—',
			phenomenon_time: String(item.phenomenon_time ?? ''),
			result: Number(item.result ?? 0),
			location: city
		};
	});
};
