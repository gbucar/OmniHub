<script lang="ts">
	import { goto } from '$app/navigation';
	import { clearAuth, login, setAuthToken } from '$lib/api';

	let password = $state('');
	let username = $state('');

	const handleSubmit = (event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }) => {
		event.preventDefault();
		login(username, password).then((user) => {
			username = '';
			password = '';
			if (user === null) return alert();
			goto('/');
		});
	};
</script>

<div class="flex min-h-screen items-center justify-center bg-base-200">
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
