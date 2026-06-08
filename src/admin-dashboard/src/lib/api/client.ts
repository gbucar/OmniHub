import { PostgrestClient } from '@supabase/postgrest-js';
import { PUBLIC_POSTGREST_URL } from '$env/static/public';
import { browser } from '$app/environment';
import { writable, type Writable } from 'svelte/store';
import { createUser, type User } from './types';

const pgClient = browser ? new PostgrestClient(PUBLIC_POSTGREST_URL) : null;
export const user: Writable<User> = writable(createUser(null));

export const setAuthToken = (token: string) => {
	if (!browser) return;
	pgClient?.headers.set('Authorization', `Bearer ${token}`);
};

export const clearAuth = () => {
	if (!browser) return;
	pgClient?.headers.delete('Authorization');
	user.set(createUser(null));
};

export const login = async (username: string, password: string) => {
	const data = await pgClient?.schema('api').rpc('login', { password, username });
	if (data?.error || !data?.data?.token) throw new Error('Invalid username or password');
	setAuthToken(data.data.token);
	user.set(createUser(username));
	return { username };
};

export { pgClient };
