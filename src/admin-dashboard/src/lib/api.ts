import { writable } from 'svelte/store';
import { PostgrestClient } from '@supabase/postgrest-js';
import { PUBLIC_POSTGREST_URL } from '$env/static/public';
import { browser } from '$app/environment';

export const pgClient = browser ? writable(new PostgrestClient(PUBLIC_POSTGREST_URL)) : null;

export const setAuthToken = (token: string) => {
	if (!browser) return;
	const newClient = new PostgrestClient(PUBLIC_POSTGREST_URL, {
		headers: {
			Authorization: `Bearer ${token}`
		}
	});
	pgClient?.set(newClient);
};

export const clearAuth = () => {
	if (!browser) return;
	pgClient?.set(new PostgrestClient(PUBLIC_POSTGREST_URL));
};
