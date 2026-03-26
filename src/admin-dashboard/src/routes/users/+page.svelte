<script lang="ts">
	import { addParticipant, getParicipants, type Participant } from '$lib/api';
	import { onMount } from 'svelte';

	let selectedParticipant: Participant | null = $state(null);
	let participants: Participant[] = $state([]);
	let showModal = $state(false);
	let newUser = $state({
		username: '',
		password: '',
		properties: { name: '' }
	});

	onMount(async () => {
		participants = await getParicipants();
		participants = [...participants, ...participants];
		selectedParticipant = participants[0];
	});

	const handleAddUser = async () => {
		await addParticipant(newUser);
		participants = await getParicipants(); // Refresh the list
		showModal = false; // Close the modal
		newUser = { username: '', password: '', properties: { name: '' } }; // Reset the form
	};
</script>

<div class="flex w-screen grow flex-row">
	<div class="w-md border-r border-r-base-200">
		<h3>Filtriraj</h3>
	</div>

	<div class=" grid h-full grid-cols-4">
		<div class="col-start-1 col-end-4 flex h-full w-full flex-col justify-between">
			<div class="w-full grow overflow-scroll">
				<table class="table-pin-rows table table-zebra">
					<thead>
						<tr>
							<th>ID</th>
							<th>Username</th>
							<th>Role</th>
							<th>Type</th>
							<th>Created At</th>
						</tr>
					</thead>
					<tbody>
						{#each participants as participant}
							<tr
								onclick={() => {
									selectedParticipant = participant;
								}}
								class={selectedParticipant?.user_id === participant.user_id
									? 'bg-primary text-primary-content'
									: ''}
							>
								<td>{participant.user_id}</td>
								<td>{participant.username}</td>
								<td>{participant.role}</td>
								<td>{participant.properties.type}</td>
								<td>{participant.sys_created_at}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="border-t border-t-base-300">
				<button class="btn btn-ghost">«</button>
				<button class="btn btn-ghost">Page 22</button>
				<button class="btn btn-ghost">»</button>
			</div>
		</div>
		<div class="flex h-full w-full flex-col border-l border-l-base-200 p-3">
			<h3 class="mb-4 text-lg font-bold">Označen prostovoljec</h3>
			{#if selectedParticipant}
				<div class="space-y-2">
					<label class="form-control w-full">
						<div class="label">
							<span class="label-text font-bold">Username:</span>
						</div>
						<input
							type="text"
							bind:value={selectedParticipant.username}
							disabled
							class="input-bordered input w-full"
						/>
					</label>
					<label class="form-control w-full">
						<div class="label">
							<span class="label-text font-bold">Role:</span>
						</div>
						<input
							type="text"
							bind:value={selectedParticipant.role}
							class="input-bordered input w-full"
						/>
					</label>
					<label class="form-control w-full">
						<div class="label">
							<span class="label-text font-bold">Created At:</span>
						</div>
						<input
							type="text"
							bind:value={selectedParticipant.sys_created_at}
							class="input-bordered input w-full"
						/>
					</label>
				</div>
				<div class="mt-4">
					<h4 class="font-semibold">Dodatne lastnosti:</h4>
					<div class="space-y-1">
						{#each Object.entries(selectedParticipant.properties) as [key, _]}
							<label class="form-control w-full">
								<div class="label">
									<span class="label-text font-bold">{key}:</span>
								</div>
								<input
									type="text"
									bind:value={selectedParticipant.properties[key]}
									class="input-bordered input w-full"
								/>
							</label>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
<!--
<button
	onclick={() => (showModal = true)}
	class="btn mt-6 shadow-md btn-lg btn-primary hover:shadow-lg">Dodaj uporabnika</button
>

{#if showModal}
	<div class="modal-open modal">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Dodaj novega uporabnika</h3>
			<div class="form-control mt-4">
				<label class="label">
					<span class="label-text">Username</span>
				</label>
				<input
					bind:value={newUser.username}
					type="text"
					placeholder="Vnesite uporabniško ime"
					class="input-bordered input"
				/>
			</div>
			<div class="form-control mt-4">
				<label class="label">
					<span class="label-text">Password</span>
				</label>
				<input
					bind:value={newUser.password}
					type="password"
					placeholder="Vnesite geslo"
					class="input-bordered input"
				/>
			</div>
			<div class="form-control mt-4">
				<label class="label">
					<span class="label-text">Name</span>
				</label>
				<input
					bind:value={newUser.properties.name}
					type="text"
					placeholder="Vnesite ime"
					class="input-bordered input"
				/>
			</div>
			<div class="modal-action">
				<button class="btn btn-primary" onclick={handleAddUser}>Shrani</button>
				<button class="btn" onclick={() => (showModal = false)}>Prekliči</button>
			</div>
		</div>
	</div>
{/if} -->
