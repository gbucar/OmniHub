<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { clearAuth, user } from '$lib/api';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Toast from '$lib/components/Toast.svelte';

	const logout = () => {
		clearAuth();
		goto('/auth/login');
	};

	$effect(() => {
		if (!$user.isLoggedIn) {
			goto('/auth/login');
		}
	});

	let { children } = $props();

	const navItems = [
		{ href: '/', label: 'Dashboard', icon: '◈' },
		{ href: '/users', label: 'Participants', icon: '◉' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex h-screen w-screen flex-col overflow-hidden">
	<header class="navbar gap-2 border-b border-neutral/30 bg-base-100 px-4">
		<div class="flex flex-1 items-center gap-4">
			<a href="/" class="flex items-center gap-2 transition-opacity hover:opacity-80">
				<div
					class="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10"
				>
					<span class="font-display text-lg font-bold text-primary">Ω</span>
				</div>
				<span class="font-display text-xl font-semibold tracking-tight">OmniHub</span>
			</a>

			<div class="ml-4 hidden items-center gap-1 md:flex">
				{#each navItems as item}
					<a
						href={item.href}
						class="btn font-mono transition-all duration-200 btn-sm
							{page.url.pathname === item.href || (item.href !== '/' && page.url.pathname.startsWith(item.href))
							? 'btn-primary'
							: 'btn-ghost'}"
					>
						<span class="opacity-60">{item.icon}</span>
						{item.label}
					</a>
				{/each}
			</div>
		</div>

		<div class="flex-none">
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="btn btn-circle btn-ghost">
					<svg viewBox="0 0 24 24" fill="none" class="h-5 w-5">
						<path
							d="M5 12H20M5 17H20M5 7H20"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
						/>
					</svg>
				</div>
				<ul
					tabindex="-1"
					class="dropdown-content menu z-1 mt-3 w-52 menu-sm rounded-box border border-neutral/20 bg-base-100 p-2 shadow-lg"
				>
					<li class="menu-title px-2 py-1">
						<span class="font-mono text-xs tracking-wider text-base-content/40 uppercase"
							>Signed in as</span
						>
					</li>
					<li class="mb-1 px-2 py-1">
						<span class="font-mono text-sm text-primary">{$user.username || 'admin'}</span>
					</li>
					<div class="divider my-1 divider-neutral"></div>
					{#if $user.isLoggedIn}
						<li><a href="/users" class="font-mono"><span class="opacity-50">◉</span> Users</a></li>
						<li>
							<button onclick={logout} class="font-mono text-error">
								<span class="opacity-50">▿</span> Logout
							</button>
						</li>
					{:else}
						<li>
							<a href="/auth/login" class="font-mono"><span class="opacity-50">◈</span> Login</a>
						</li>
					{/if}
				</ul>
			</div>
		</div>
	</header>

	<main class="min-h-0 flex-1 overflow-auto">
		{@render children()}
	</main>
</div>

<Toast />
