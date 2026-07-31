import { redirect } from '@sveltejs/kit';
import { get } from 'svelte/store';
import type { LayoutLoad } from './$types';
import { user } from '$lib/api';

// Authentication is handled entirely in the browser (PostgREST token stored
// on the client). Disable SSR so protected pages are never rendered on the
// server and unauthenticated users are redirected before any content is shown.
export const ssr = false;

export const load: LayoutLoad = async ({ url }) => {
	const isLoggedIn = get(user).isLoggedIn;
	const isLoginPage = url.pathname === '/auth/login';

	if (!isLoggedIn && !isLoginPage) {
		redirect(302, '/auth/login');
	}

	return {};
};
