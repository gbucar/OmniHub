<script lang="ts">
	import { goto } from '$app/navigation';
	import { clearAuth, login, setAuthToken } from '$lib/api';

	let password = $state('');
	let username = $state('');

	let toastMessage = $state('');
	let toastType = $state<'success' | 'error'>('success');
	let showToast = $state(false);

	const handleSubmit = async (
		event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }
	) => {
		event.preventDefault();
		try {
			const user = await login(username, password);
			username = '';
			password = '';
			goto('/');
		} catch (error) {
			showToastMessage('Invalid username or password', 'error');
		}
	};

	const showToastMessage = (message: string, type: 'success' | 'error') => {
		toastMessage = message;
		toastType = type;
		showToast = true;
		setTimeout(() => {
			showToast = false;
		}, 3000);
	};
</script>

<div class="flex h-full items-center justify-center bg-base-200">
	<form
		onsubmit={handleSubmit}
		method="POST"
		class="w-full max-w-sm rounded-lg bg-base-100 p-6 shadow-md"
	>
		<h2 class="mb-6 text-center text-2xl font-bold">Login</h2>

		<div class="form-control mb-4">
			<label for="username" class="label">
				<span class="label-text">Username</span>
			</label>
			<input
				bind:value={username}
				name="username"
				type="text"
				placeholder="Enter your username"
				class="input-bordered input w-full"
			/>
		</div>

		<div class="form-control mb-6">
			<label for="password" class="label">
				<span class="label-text">Password</span>
			</label>
			<input
				bind:value={password}
				name="password"
				type="password"
				placeholder="Enter your password"
				class="input-bordered input w-full"
			/>
		</div>

		<button class="btn w-full btn-primary">Login</button>
	</form>
</div>

{#if showToast}
	<div class="toast toast-start toast-bottom">
		<div class="alert {toastType === 'success' ? 'alert-success' : 'alert-error'}">
			<span>{toastMessage}</span>
		</div>
	</div>
{/if}
