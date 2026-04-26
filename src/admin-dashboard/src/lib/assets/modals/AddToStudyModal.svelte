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
		onAdd: (studyToAdd: string, studyStart: string, studyEnd: string) => void;
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
</script>

{#if show}
	<div class="modal-open modal">
		<div class="modal-box max-w-md bg-base-100">
			<div class="mb-6 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-base-content">Add Participant to Study</h3>
				<button class="btn btn-circle btn-ghost btn-sm" onclick={onClose}>✕</button>
			</div>

			<div class="space-y-4">
				<div class="form-control">
					<label class="label">
						<span class="label-text">Select Study</span>
					</label>
					<select class="select-bordered select select-sm" bind:value={studyToAdd}>
						<option value="" disabled>Select a study</option>
						{#each studies.filter((study) => !participantStudies.some((ps) => ps.study_id === study.id)) as study}
							<option value={study.id.toString()}>{study.name}</option>
						{/each}
					</select>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="form-control">
						<label class="label">
							<span class="label-text">Membership Start Date</span>
						</label>
						<input class="input-bordered input input-sm" type="date" bind:value={studyStart} />
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text">Membership End Date</span>
						</label>
						<input class="input-bordered input input-sm" type="date" bind:value={studyEnd} />
					</div>
				</div>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={onClose}>Cancel</button>
				<button class="btn btn-primary" onclick={() => onAdd(studyToAdd, studyStart, studyEnd)}
					>Add to Study</button
				>
			</div>
		</div>
	</div>
{/if}
