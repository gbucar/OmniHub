<script lang="ts">
	import { goto } from '$app/navigation';
	import { login } from '$lib/api';
	import { showToast } from '$lib/stores/toast';
	import PasswordInput from '$lib/components/PasswordInput.svelte';

	let password = $state('');
	let username = $state('');
	let isLoading = $state(false);

	const handleSubmit = async (
		event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }
	) => {
		event.preventDefault();
		isLoading = true;
		try {
			await login(username, password);
			username = '';
			password = '';
			goto('/');
		} catch (error) {
			showToast('Invalid username or password', 'error');
		} finally {
			isLoading = false;
		}
	};
</script>

<svelte:head>
	<title>Sign In — OmniHub</title>
</svelte:head>

<div
	class="relative flex h-full min-h-screen items-center justify-center overflow-hidden bg-base-100"
>
	<div
		class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent"
	></div>

	<div class="animate-fade-in-up card w-full max-w-sm bg-base-200 shadow-2xl">
		<div class="card-body p-8">
			<div class="mb-6 flex flex-col items-center">
				<div
					class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 shadow-lg shadow-primary/10"
				>
					<span class="font-display text-2xl font-bold text-primary">Ω</span>
				</div>
				<h1 class="font-display text-2xl font-bold">Welcome back</h1>
				<p class="mt-1 text-sm text-base-content/50">Sign in to access the dashboard</p>
			</div>

			<form onsubmit={handleSubmit} method="POST" class="space-y-4">
				<div class="form-control">
					<label class="label" for="username">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/50 uppercase"
							>Username</span
						>
					</label>
					<input
						id="username"
						bind:value={username}
						name="username"
						type="text"
						placeholder="Enter your username"
						class="input-bordered input w-full"
						required
					/>
				</div>

				<div class="form-control">
					<label class="label" for="password">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/50 uppercase"
							>Password</span
						>
					</label>
					<PasswordInput
						id="password"
						name="password"
						placeholder="Enter your password"
						autocomplete="current-password"
						bind:value={password}
						required
					/>
				</div>

				<button type="submit" disabled={isLoading} class="btn mt-6 w-full btn-primary">
					{#if isLoading}
						<span class="loading loading-sm loading-spinner"></span>
					{:else}
						Sign In
					{/if}
				</button>
			</form>

			<p class="mt-6 text-center font-mono text-xs text-base-content/30">
				OmniHub Research Platform
			</p>
		</div>
	</div>
</div>
