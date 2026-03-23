<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	import { PostgrestClient } from '@supabase/postgrest-js';
	import { setContext } from 'svelte';
	import { browser } from '$app/environment';
	import { clearAuth } from '$lib/api';

	if (browser) {
		const REST_URL = 'http://localhost:3000';
		const postgrest = new PostgrestClient(REST_URL);

		setContext('postgrest', postgrest);
	}

	let { children } = $props();
</script>

<nav>
	<button
		onclick={() => {
			clearAuth();
		}}>logout</button
	>
</nav>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
