import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	envDir: '../../', // use root .env
	envPrefix: ['PUBLIC_', 'POSTGREST_'] // expose POSTGREST_URL to client
});
