<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { clearAuth, user } from '$lib/api';
	import { goto, onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import Toast from '$lib/components/Toast.svelte';

	// Enables browser-native crossfade transitions between all client-side navigations.
	// Falls back gracefully in browsers that don't support the View Transitions API.
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

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

	let theme = $state<'omnihub' | 'omnihub-dark'>('omnihub');

	function restoreTheme() {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('theme');
			if (saved === 'omnihub' || saved === 'omnihub-dark') {
				theme = saved;
			} else {
				theme = window.matchMedia('(prefers-color-scheme: dark)').matches
					? 'omnihub-dark'
					: 'omnihub';
			}
			document.documentElement.setAttribute('data-theme', theme);
		}
	}

	function toggleTheme() {
		theme = theme === 'omnihub' ? 'omnihub-dark' : 'omnihub';
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('theme', theme);
	}

	$effect(restoreTheme);

	const navItems = [
		{ href: '/', label: 'Dashboard', icon: '◈' },
		{ href: '/users', label: 'Participants', icon: '◉' },
		{ href: '/devices', label: 'Devices', icon: '◐' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex h-screen w-screen flex-col overflow-hidden">
	<header class="navbar relative z-30 gap-2 border-b border-neutral/30 bg-base-100 px-4">
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

		<div class="flex flex-none items-center gap-1">
			<button
				onclick={toggleTheme}
				class="btn btn-circle btn-ghost"
				aria-label={theme === 'omnihub' ? 'Switch to dark theme' : 'Switch to light theme'}
			>
				{#if theme === 'omnihub-dark'}
					<!-- sun icon -->
					<svg
						class="h-5 w-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="5" />
						<path
							d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
						/>
					</svg>
				{:else}
					<!-- moon icon -->
					<svg
						class="h-5 w-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
					</svg>
				{/if}
			</button>

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
					class="dropdown-content menu mt-3 w-52 menu-sm rounded-box border border-neutral/20 bg-base-100 p-2 shadow-lg"
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
							<a href="/devices" class="font-mono"><span class="opacity-50">◐</span> Devices</a>
						</li>
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
