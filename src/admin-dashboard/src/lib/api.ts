import { writable, type Writable } from 'svelte/store';
import { PostgrestClient } from '@supabase/postgrest-js';
import { PUBLIC_POSTGREST_URL } from '$env/static/public';
import { browser } from '$app/environment';

export type Participant = {
	username: string;
	password: string;
	role: string;
	properties: Record<string, unknown>;
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

// export const isLoggedIn = () => {
// 	return pgClient?.headers.get('Authorization')?.includes('Bearer') ?? false;
// };

export const login = async (username: string, password: string) => {
	let data = await pgClient?.schema('api').rpc('login', { password, username });
	if (data?.error || !data?.data.token) return null;
	setAuthToken(data.data.token);
	user.set(new User(username));
	return { username };
};

export const getParicipants = async () => {
	let data = await pgClient?.from('participants').select('*');
	return data?.data ?? [];
};

export const addParticipant = async (participant: Participant) => {
	let data = await pgClient?.schema('api').rpc('add_participant', { ...participant });
	return data?.data ?? null;
};
