<script lang="ts">
	interface Props {
		show: boolean;
		studyToAdd: string;
		studyStart: string;
		studyEnd: string;
		studies: { id: number; name: string }[];
		participantStudies: {
			study_id: number;
			membership_period: string | null;
			studies: { id: number; name: string };
		}[];
		onAdd: () => void;
		onClose: () => void;
	}

	let {
		show,
		studyToAdd = $bindable(''),
		studyStart = $bindable(''),
		studyEnd = $bindable(''),
		studies,
		participantStudies,
		onAdd,
		onClose
	}: Props = $props();

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

	const availableStudies = $derived(
		studies.filter((study) => !participantStudies.some((ps) => ps.study_id === study.id))
	);
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
				<h3 class="font-display text-lg font-semibold">Add to Study</h3>
				<p class="font-mono text-xs text-base-content/40">Assign participant to research study</p>
			</div>
		</div>

		<div class="space-y-4">
			<div class="form-control">
				<label class="label" for="select-study">
					<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
						>Select Study</span
					>
				</label>
				<select
					id="select-study"
					class="select-bordered select w-full"
					bind:value={studyToAdd}
					required
				>
					<option value="" disabled>Choose a study</option>
					{#each availableStudies as study}
						<option value={study.id.toString()}>{study.name}</option>
					{/each}
				</select>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="form-control">
					<label class="label" for="membership-start">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
							>Start Date</span
						>
					</label>
					<input
						id="membership-start"
						type="date"
						class="input-bordered input w-full"
						bind:value={studyStart}
					/>
				</div>
				<div class="form-control">
					<label class="label" for="membership-end">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
							>End Date</span
						>
					</label>
					<input
						id="membership-end"
						type="date"
						class="input-bordered input w-full"
						bind:value={studyEnd}
					/>
				</div>
			</div>
		</div>

		<div class="modal-action">
			<form method="dialog">
				<button class="btn btn-ghost">Cancel</button>
			</form>
			<button class="btn btn-accent" onclick={onAdd}>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 5v14M5 12h14" />
				</svg>
				Add to Study
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
