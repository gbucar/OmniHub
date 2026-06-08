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
