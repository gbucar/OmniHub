<script lang="ts">
	import { pgClient } from '$lib/api';
	import { onMount } from 'svelte';

	let participants = $state([]);

	onMount(async () => {
		let data = await $pgClient?.from('participants').select('*');
		if (data?.data) {
			console.log(data);
			participants = data.data;
		}
	});

	const addUser = async () => {
		const res = await $pgClient?.from('participants').insert({
			username: 'andrej_senica',
			role: 'webuser'
		});
		console.log(res);
	};
</script>

<div>
	<table>
		<thead>
			<tr>
				<th>id</th>
				<th>created at</th>
			</tr>
		</thead>

		<tbody>
			{#each participants as participant}
				<tr>
					<td>{participant.user_id}</td>
					<td>{participant.properties.type}</td>
					<td>{participant.sys_created_at}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<button onclick={addUser}> dodaj uporabnika </button>
