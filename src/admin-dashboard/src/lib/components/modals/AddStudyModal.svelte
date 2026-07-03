<script lang="ts">
	interface Props {
		show: boolean;
		newStudy: {
			name: string;
			activePeriodStart: string;
			activePeriodEnd: string;
		};
		onAdd: (study: typeof newStudy) => void;
		onClose: () => void;
	}

	let { show, newStudy = $bindable(), onAdd, onClose }: Props = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	let dateError = $derived(
		newStudy.activePeriodStart && newStudy.activePeriodEnd && newStudy.activePeriodEnd < newStudy.activePeriodStart
			? 'End date must be on or after start date'
			: ''
	);

	let isFormValid = $derived(
		newStudy.name.trim() !== '' &&
		newStudy.activePeriodStart !== '' &&
		newStudy.activePeriodEnd !== '' &&
		dateError === ''
	);

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
		if (!isFormValid) return;
		onAdd(newStudy);
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
				class="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/20 bg-accent/10"
			>
				<svg
					class="h-5 w-5 text-accent"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
					<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
				</svg>
			</div>
			<div>
				<h3 class="font-display text-lg font-semibold">Add Study</h3>
				<p class="font-mono text-xs text-base-content/40">Create new research study</p>
			</div>
		</div>

		<div class="space-y-4">
			<div class="form-control">
				<label class="label" for="study-name">
					<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
						>Study Name</span
					>
				</label>
				<input
					id="study-name"
					class="input-bordered input w-full"
					placeholder="Enter study name"
					bind:value={newStudy.name}
					required
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="form-control">
					<label class="label" for="study-start">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
							>Start Date</span
						>
					</label>
					<input
						id="study-start"
						type="date"
						class="input-bordered input w-full"
						bind:value={newStudy.activePeriodStart}
						required
					/>
				</div>
				<div class="form-control">
					<label class="label" for="study-end">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
							>End Date</span
						>
					</label>
					<input
						id="study-end"
						type="date"
						class="input-bordered input w-full"
						bind:value={newStudy.activePeriodEnd}
						min={newStudy.activePeriodStart || undefined}
						required
					/>
				</div>
			</div>
			{#if dateError}
				<div class="alert alert-error alert-sm">
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10" />
						<path d="M12 8v4M12 16h.01" />
					</svg>
					<span class="text-xs">{dateError}</span>
				</div>
			{/if}
		</div>

		<div class="modal-action">
			<form method="dialog">
				<button class="btn btn-ghost">Cancel</button>
			</form>
			<button class="btn btn-accent" onclick={handleSubmit} disabled={!isFormValid}>
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
