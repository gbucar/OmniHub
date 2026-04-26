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
</script>

{#if show}
	<div class="modal-open modal">
		<div class="modal-box max-w-md bg-base-100">
			<div class="mb-6 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-base-content">Add New Study</h3>
				<button class="btn btn-circle btn-ghost btn-sm" onclick={onClose}>✕</button>
			</div>

			<div class="space-y-4">
				<div class="form-control">
					<label class="label">
						<span class="label-text">Study Name</span>
					</label>
					<input
						class="input-bordered input input-sm"
						placeholder="Enter study name"
						bind:value={newStudy.name}
					/>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="form-control">
						<label class="label">
							<span class="label-text">Active Period Start Date</span>
						</label>
						<input
							class="input-bordered input input-sm"
							type="date"
							bind:value={newStudy.activePeriodStart}
						/>
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text">Active Period End Date</span>
						</label>
						<input
							class="input-bordered input input-sm"
							type="date"
							bind:value={newStudy.activePeriodEnd}
						/>
					</div>
				</div>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={onClose}>Cancel</button>
				<button class="btn btn-primary" onclick={() => onAdd(newStudy)}>Add Study</button>
			</div>
		</div>
	</div>
{/if}
