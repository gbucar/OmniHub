import { writable, type Writable } from 'svelte/store';
import { PostgrestClient } from '@supabase/postgrest-js';
import { PUBLIC_POSTGREST_URL } from '$env/static/public';
import { browser } from '$app/environment';

export type Sensor = {
	id: number;
	name: string;
	description?: string;
	properties?: Record<string, unknown>;
	credential_id?: number;
	sys_created_at?: string;
	last_activity?: string;
};

export type Ownership = {
	user_id: string;
	sensor_id: number;
	start_date: string;
	end_date: string;
	sys_created_at?: string;
	sensors?: Sensor[];
};

export type Participant = {
	user_id: string;
	username: string | null;
	role: string | null;
	properties: Record<string, unknown> | null;
	study_name: string | null;
};

export class User {
	username: string | null;

	isLoggedIn: boolean;

	constructor(username: string | null) {
		this.username = username;
		this.isLoggedIn = !!username;
	}
}

const pgClient = browser ? new PostgrestClient(PUBLIC_POSTGREST_URL) : null;
export const user: Writable<User> = writable(new User(null));

export const setAuthToken = (token: string) => {
	if (!browser) return;
	pgClient?.headers.set('Authorization', `Bearer ${token}`);
};

export const clearAuth = () => {
	if (!browser) return;
	pgClient?.headers.delete('Authorization');
	user.set(new User(null));
};

export const login = async (username: string, password: string) => {
	let data = await pgClient?.schema('api').rpc('login', { password, username });
	if (data?.error || !data?.data.token) throw new Error('Invalid username or password');
	setAuthToken(data.data.token);
	user.set(new User(username));
	return { username };
};

export const getParicipants = async (filters?: {
	search?: string;
	study?: string;
	limit?: number;
	offset?: number;
}) => {
	let query = pgClient?.from('list_participants').select('*', { count: 'exact' });

	if (filters?.search) {
		// Search in both username and properties.name
		query = query?.or(
			`username.ilike.%${filters.search}%,properties->>name.ilike.%${filters.search}%`
		);
	}

	if (filters?.study && filters.study !== 'all') {
		query = query?.eq('study_id', parseInt(filters.study));
	}

	if (filters?.limit) {
		query = query?.limit(filters.limit);
	}

	if (filters?.offset) {
		query = query?.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
	}

	let data = await query;
	return {
		data: data?.data ?? [],
		count: data?.count ?? 0
	};
};

export const getStudies = async () => {
	let data = await pgClient?.from('studies').select('id, name');
	return data?.data ?? [];
};

export const addStudy = async (study: {
	name: string;
	activePeriodStart: string;
	activePeriodEnd: string;
}) => {
	const rangeString = `[${study.activePeriodStart},${study.activePeriodEnd})`;
	let data = await pgClient
		?.from('studies')
		.insert({ name: study.name, active_period: rangeString });
	if (data?.error) {
		throw new Error(data.error.message);
	}
	return data?.data ?? null;
};

export const addParticipant = async (participant: {
	username: string;
	password: string;
	properties: Record<string, unknown>;
}) => {
	let data = await pgClient?.schema('api').rpc('add_participant', {
		username: participant.username,
		password: participant.password,
		properties: participant.properties
	});
	return data?.data ?? null;
};

export const getParticipantStudies = async (userId: string) => {
	let data = await pgClient
		?.from('many_participants_studies')
		.select(
			`
		study_id,
		membership_period,
		studies!inner (
			id,
			name
		)
	`
		)
		.eq('user_id', userId);
	return data?.data ?? [];
};

export const updateParticipant = async (participant: {
	user_id: string;
	properties: Record<string, unknown>;
}) => {
	let data = await pgClient
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

export const addParticipantToStudy = async (
	userId: string,
	studyId: number,
	membershipPeriod?: string | null
) => {
	let data = await pgClient?.from('many_participants_studies').insert({
		user_id: userId,
		study_id: studyId,
		membership_period: membershipPeriod || null
	});
	if (data?.error) {
		throw new Error(data.error.message);
	}
	return data?.data ?? null;
};

export const updateParticipantStudyPeriod = async (
	userId: string,
	studyId: number,
	membershipPeriod: string | null
) => {
	let data = await pgClient
		?.from('many_participants_studies')
		.update({ membership_period: membershipPeriod })
		.eq('user_id', userId)
		.eq('study_id', studyId);
	if (data?.error) {
		throw new Error(data.error.message);
	}
	return data?.data ?? null;
};

export const getSensors = async () => {
	let data = await pgClient?.from('sensors').select('*');
	return data?.data ?? [];
};

export const getUserOwnerships = async (userId: string): Promise<Ownership[]> => {
	let data = await pgClient
		?.from('ownerships')
		.select(
			`
			user_id,
			sensor_id,
			start_date,
			end_date,
			sys_created_at,
			sensors (
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
	return data?.data ?? [];
};

export const addOwnership = async (ownership: {
	user_id: string;
	sensor_id: number;
	start_date: string;
	end_date: string;
}) => {
	let data = await pgClient?.from('ownerships').insert(ownership);
	if (data?.error) {
		throw new Error(data.error.message);
	}
	return data?.data ?? null;
};
