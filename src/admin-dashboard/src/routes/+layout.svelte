<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { clearAuth, user } from '$lib/api';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/state';

	const logout = () => {
		clearAuth();
		goto('/');
	};

	$effect(() => {
		if (!$user.isLoggedIn) {
			goto('/auth/login');
		}
	});

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex h-screen w-screen flex-col">
	<div class="bg-base-50 navbar flex-none border-b border-b-base-300">
		<div class="flex flex-1 flex-row items-center">
			<a href="/" class="btn text-xl btn-ghost">OmniHub</a>
			<div class="breadcrumbs text-sm">
				<ul>
					<li>
						<a href="/" class="text-gray-600">Home</a>
					</li>
					{#each page.url.pathname.split('/') as segment, i}
						{#if segment}
							<li>
								{#if i === page.url.pathname.split('/').length - 1}
									<span class="font-bold">{segment}</span>
								{:else}
									<a
										href={page.url.pathname
											.split('/')
											.slice(0, i + 1)
											.join('/')}
										class="text-gray-600">{segment}</a
									>
								{/if}
							</li>
						{/if}
					{/each}
				</ul>
			</div>
		</div>

		<div class="flex-none">
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="btn avatar btn-circle btn-ghost">
					<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
						><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g
							id="SVGRepo_tracerCarrier"
							stroke-linecap="round"
							stroke-linejoin="round"
						></g><g id="SVGRepo_iconCarrier">
							<path d="M5 12H20" stroke="#000000" stroke-width="2" stroke-linecap="round"></path>
							<path d="M5 17H20" stroke="#000000" stroke-width="2" stroke-linecap="round"></path>
							<path d="M5 7H20" stroke="#000000" stroke-width="2" stroke-linecap="round"></path>
						</g></svg
					>
				</div>
				<ul
					tabindex="-1"
					class="dropdown-content menu z-1 mt-3 w-52 menu-sm rounded-box bg-base-100 p-2 shadow"
				>
					{#if $user.isLoggedIn}
						<li><a href="/users">users</a></li>
						<li><button onclick={logout}>logout</button></li>
					{:else}
						<li><a href="/auth/login">login</a></li>
					{/if}
				</ul>
			</div>
		</div>
	</div>

	<div class="min-h-0 w-full flex-1">
		{@render children()}
	</div>
</div>
