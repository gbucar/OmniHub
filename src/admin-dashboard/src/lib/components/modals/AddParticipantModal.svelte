<script lang="ts">
	import PasswordInput from '../PasswordInput.svelte';

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

	let dialogEl = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		if (show && dialogEl) {
			dialogEl.showModal();
		} else if (!show && dialogEl) {
			dialogEl.close();
		}
	});

	const handleClose = () => {
		dialogEl?.close();
		onClose();
	};

	const handleSubmit = () => {
		onAdd(newUser);
	};
</script>

<dialog bind:this={dialogEl} class="modal" onclose={handleClose}>
	<div class="modal-box bg-base-200">
		<form method="dialog">
			<button class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm" aria-label="Close">
				<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</form>

		<div class="mb-6 flex items-center gap-3">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10"
			>
				<svg
					class="h-5 w-5 text-primary"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
					<circle cx="8.5" cy="7" r="4" />
					<line x1="20" y1="8" x2="20" y2="14" />
					<line x1="23" y1="11" x2="17" y2="11" />
				</svg>
			</div>
			<div>
				<h3 class="font-display text-lg font-semibold">Add Participant</h3>
				<p class="font-mono text-xs text-base-content/40">Create new research participant</p>
			</div>
		</div>

		<div class="space-y-4">
			<div class="grid grid-cols-2 gap-4">
				<div class="form-control">
					<label class="label" for="modal-username">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
							>Username</span
						>
					</label>
					<input
						id="modal-username"
						class="input-bordered input w-full"
						placeholder="Enter username"
						bind:value={newUser.username}
						required
					/>
				</div>
				<div class="form-control">
					<label class="label" for="modal-password">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
							>Password</span
						>
					</label>
					<PasswordInput
						id="modal-password"
						placeholder="Enter password"
						autocomplete="new-password"
						bind:value={newUser.password}
						required
					/>
				</div>
			</div>

			<div class="grid grid-cols-3 gap-4">
				<div class="form-control">
					<label class="label" for="modal-name">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
							>Name</span
						>
					</label>
					<input
						id="modal-name"
						class="input-bordered input w-full"
						placeholder="Full name"
						bind:value={newUser.properties.name}
						required
					/>
				</div>
				<div class="form-control">
					<label class="label" for="modal-age">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
							>Age</span
						>
					</label>
					<input
						id="modal-age"
						type="number"
						class="input-bordered input w-full"
						placeholder="Age"
						min="1"
						max="120"
						bind:value={newUser.properties.age}
					/>
				</div>
				<div class="form-control">
					<label class="label" for="modal-sex">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
							>Sex</span
						>
					</label>
					<select
						id="modal-sex"
						class="select-bordered select w-full"
						bind:value={newUser.properties.sex}
					>
						<option value="" disabled>Select</option>
						<option value="male">Male</option>
						<option value="female">Female</option>
					</select>
				</div>
			</div>
		</div>

		<div class="modal-action">
			<form method="dialog">
				<button class="btn btn-ghost">Cancel</button>
			</form>
			<button class="btn btn-primary" onclick={handleSubmit}>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 5v14M5 12h14" />
				</svg>
				Create
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
