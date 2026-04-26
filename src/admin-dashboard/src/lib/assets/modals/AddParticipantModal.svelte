<script lang="ts">
	import type { Participant } from '$lib/api';

	interface Props {
		show: boolean;
		newUser: {
			username: string;
			password: string;
			properties: {
				name: string;
				age: string;
				sex: string;
			};
		};
		onAdd: (user: typeof newUser) => void;
		onClose: () => void;
	}

	let { show, newUser = $bindable(), onAdd, onClose }: Props = $props();
</script>

{#if show}
	<div class="modal-open modal">
		<div class="modal-box max-w-md bg-base-100">
			<div class="mb-6 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-base-content">Add New Participant</h3>
				<button class="btn btn-circle btn-ghost btn-sm" onclick={onClose}>✕</button>
			</div>

			<div class="space-y-4">
				<!-- Username and Password row -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="form-control">
						<label class="label">
							<span class="label-text">Username</span>
						</label>
						<input
							class="input-bordered input input-sm"
							placeholder="Enter username"
							bind:value={newUser.username}
						/>
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text">Password</span>
						</label>
						<input
							type="password"
							class="input-bordered input input-sm"
							placeholder="Enter password"
							bind:value={newUser.password}
						/>
					</div>
				</div>

				<!-- Name, Age, Sex row -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div class="form-control">
						<label class="label">
							<span class="label-text">Name</span>
						</label>
						<input
							class="input-bordered input input-sm"
							placeholder="Enter name"
							bind:value={newUser.properties.name}
						/>
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text">Age</span>
						</label>
						<input
							type="number"
							class="input-bordered input input-sm"
							placeholder="Age"
							min="1"
							max="120"
							bind:value={newUser.properties.age}
						/>
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text">Sex</span>
						</label>
						<select class="select-bordered select select-sm" bind:value={newUser.properties.sex}>
							<option value="" disabled>Select sex</option>
							<option value="male">Male</option>
							<option value="female">Female</option>
						</select>
					</div>
				</div>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={onClose}>Cancel</button>
				<button class="btn btn-primary" onclick={() => onAdd(newUser)}>Create Participant</button>
			</div>
		</div>
	</div>
{/if}
