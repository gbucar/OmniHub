import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ url }) => {
	const publicPaths = ['/', '/auth/login'];
	const isPublicPath = publicPaths.some((path) => url.pathname === path);

	if (!isPublicPath) {
		// Auth check happens client-side via the layout component
		// This load function ensures we don't redirect on public paths
	}

	return {};
};
