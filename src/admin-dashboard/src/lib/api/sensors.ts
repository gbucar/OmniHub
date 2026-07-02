import { pgClient } from './client';
import type { Sensor, Ownership } from './types';

export const getSensors = async (): Promise<Sensor[]> => {
	const data = await pgClient?.from('list_sensors').select('*');
	return (data?.data ?? []) as Sensor[];
};

export const getUserOwnerships = async (userId: string): Promise<Ownership[]> => {
	const data = await pgClient
		?.from('ownerships')
		.select(
			`
			user_id,
			sensor_id,
			start_date,
			end_date,
			sys_created_at,
			list_sensors (
				id,
				name,
				description,
				properties,
				credential_id,
				sys_created_at,
				last_activity
			)
		`
		)
		.eq('user_id', userId);

	const raw = data?.data ?? [];
	return raw.map((item: Record<string, unknown>) => ({
		user_id: item.user_id as string,
		sensor_id: item.sensor_id as number,
		start_date: item.start_date as string,
		end_date: item.end_date as string,
		sys_created_at: item.sys_created_at as string | undefined,
		list_sensors: (item.list_sensors as unknown as Sensor[] | undefined)?.[0]
	})) as Ownership[];
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
