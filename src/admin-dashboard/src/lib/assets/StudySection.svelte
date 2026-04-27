<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	interface Props {
		studies: { id: number; name: string }[];
		participantStudies: {
			study_id: number;
			membership_period: string | null;
			studies: { id: number; name: string };
		}[];
		isEditing: boolean;
	}

	let { studies, participantStudies, isEditing }: Props = $props();

	let editingStudyId = $state<string | null>(null);
	let localEditStart = $state('');
	let localEditEnd = $state('');

	const dispatch = createEventDispatcher<{
		saveStudyPeriod: { studyId: number; start: string; end: string };
		addToStudy: void;
	}>();
</script>

<div class="form-control">
	<div class="flex items-center justify-between">
		<label class="label">
			<span class="label-text">Studies</span>
		</label>
		{#if !isEditing}
			<button class="btn btn-sm btn-secondary" onclick={() => dispatch('addToStudy')}>
				Add to Study
			</button>
		{/if}
	</div>
	<div class="mt-2">
		{#if participantStudies.length === 0}
			<span class="text-base-content/70">No studies assigned</span>
		{:else}
			<div class="space-y-2">
				{#each participantStudies as participantStudy}
					<div class="flex flex-col gap-1 rounded bg-base-200 p-2">
						<div class="flex items-center justify-between">
							<span class="badge badge-primary">{participantStudy.studies.name}</span>
							{#if editingStudyId !== participantStudy.study_id.toString()}
								<button
									class="btn btn-ghost btn-xs"
									onclick={() => {
										editingStudyId = participantStudy.study_id.toString();
										if (participantStudy.membership_period) {
											const parsedPeriod = (() => {
												try {
													const parsed = JSON.parse(participantStudy.membership_period);
													if (Array.isArray(parsed) && parsed.length === 2) {
														return {
															start: parsed[0].split(' ')[0],
															end: parsed[1].split(' ')[0]
														};
													}
												} catch (e) {
													const match =
														participantStudy.membership_period.match(/\[([^,]+),\s*([^)]+)\)/);
													if (match) {
														return {
															start: match[1].slice(1, -1).split(' ')[0],
															end: match[2].slice(1, -2).split(' ')[0]
														};
													}
												}
												return null;
											})();
											if (parsedPeriod) {
												localEditStart = parsedPeriod.start;
												localEditEnd = parsedPeriod.end;
											}
										} else {
											localEditStart = '';
											localEditEnd = '';
										}
									}}
								>
									Edit
								</button>
							{:else}
								<div class="flex gap-1">
									<button
										class="btn btn-ghost btn-xs"
										onclick={() => {
											editingStudyId = null;
											localEditStart = '';
											localEditEnd = '';
										}}
									>
										Cancel
									</button>
									<button
										class="btn btn-xs btn-primary"
										onclick={() => {
											dispatch('saveStudyPeriod', {
												studyId: participantStudy.study_id,
												start: localEditStart,
												end: localEditEnd
											});
											editingStudyId = null;
											localEditStart = '';
											localEditEnd = '';
										}}
									>
										Save
									</button>
								</div>
							{/if}
						</div>
						{#if editingStudyId === participantStudy.study_id.toString()}
							<div class="mt-1 flex gap-2">
								<input
									class="input-bordered input input-xs flex-1"
									type="date"
									placeholder="Start"
									bind:value={localEditStart}
								/>
								<span class="self-center text-xs text-base-content/70">to</span>
								<input
									class="input-bordered input input-xs flex-1"
									type="date"
									placeholder="End"
									bind:value={localEditEnd}
								/>
							</div>
						{:else if participantStudy.membership_period}
							{@const parsedPeriod = (() => {
								try {
									const parsed = JSON.parse(participantStudy.membership_period);
									if (Array.isArray(parsed) && parsed.length === 2) {
										return {
											start: new Date(parsed[0].replace('+00', 'Z')).toLocaleDateString(),
											end: new Date(parsed[1].replace('+00', 'Z')).toLocaleDateString()
										};
									}
								} catch (e) {
									// Try the old regex format as fallback
									const match = participantStudy.membership_period.match(/\[([^,]+),\s*([^)]+)\)/);
									if (match) {
										return {
											start: new Date(match[1].replace('+00', 'Z')).toLocaleDateString(),
											end: new Date(match[2].replace('+00', 'Z')).toLocaleDateString()
										};
									}
								}
								return null;
							})()}
							{#if parsedPeriod}
								<span class="text-xs text-base-content/70">
									{parsedPeriod.start} to {parsedPeriod.end}
								</span>
							{:else}
								<span class="text-xs text-base-content/70">Invalid period</span>
							{/if}
						{:else}
							<span class="text-xs text-base-content/70">No period set</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
