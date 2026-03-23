<script lang="ts">
	import { goto } from '$app/navigation';
	import { clearAuth, pgClient, setAuthToken } from '$lib/api';

	let password = $state('');
	let username = $state('');

	let login = async () => {
		let data = await $pgClient?.schema('api').rpc('login', { password, username });
		if (data?.error || !data?.data.token) return alert('Napaka, poskusite znova');
		password = '';
		username = '';
		setAuthToken(data.data.token);
		goto('/');
	};

	const handleSubmit = (event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }) => {
		event.preventDefault();
		login();
	};
</script>

<form onsubmit={handleSubmit} method="POST">
	<label for="username">
		username
		<input bind:value={username} name="username" type="text" />
	</label>

	<label for="password">
		password
		<input bind:value={password} name="password" type="password" />
	</label>
	<button> login </button>
</form>
