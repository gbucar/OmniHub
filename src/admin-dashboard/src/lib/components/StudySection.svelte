<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { parseMembershipPeriod, formatMembershipPeriodDisplay } from '$lib/utils/period';

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

	let studyDateError = $derived(
		localEditStart && localEditEnd && localEditEnd < localEditStart
			? 'End date must be on or after start date'
			: ''
	);

	const dispatch = createEventDispatcher<{
		saveStudyPeriod: { studyId: number; start: string; end: string };
		addToStudy: void;
	}>();
</script>

<div class="form-control">
	<div class="flex items-center justify-between">
		<span class="font-mono text-xs tracking-wider text-base-content/40 uppercase">Studies</span>
		{#if !isEditing}
			<button class="btn btn-sm btn-accent" onclick={() => dispatch('addToStudy')}>
				<svg
					class="h-3.5 w-3.5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M12 5v14M5 12h14" />
				</svg>
				Add
			</button>
		{/if}
	</div>
	<div class="mt-3">
		{#if participantStudies.length === 0}
			<div class="flex flex-col items-center justify-center py-4 text-base-content/30">
				<svg
					class="mb-1.5 h-6 w-6 opacity-30"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
					<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
				</svg>
				<span class="font-mono text-xs">No studies assigned</span>
			</div>
		{:else}
			<div class="space-y-2">
				{#each participantStudies as participantStudy (participantStudy.study_id)}
					<div class="rounded-lg bg-base-300 p-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<div
									class="flex h-6 w-6 items-center justify-center rounded border border-accent/20 bg-accent/10"
								>
									<svg
										class="h-3 w-3 text-accent"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
										<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
									</svg>
								</div>
								<span class="font-mono text-sm">{participantStudy.studies?.name ?? 'Unknown'}</span>
							</div>
							{#if editingStudyId !== participantStudy.study_id.toString()}
								<button
									class="btn btn-circle btn-ghost btn-xs"
									onclick={() => {
										editingStudyId = participantStudy.study_id.toString();
										if (participantStudy.membership_period) {
											const parsedPeriod = parseMembershipPeriod(
												participantStudy.membership_period
											);
											if (parsedPeriod) {
												localEditStart = parsedPeriod.start;
												localEditEnd = parsedPeriod.end;
											}
										} else {
											localEditStart = '';
											localEditEnd = '';
										}
									}}
									aria-label="Edit study period"
								>
									<svg
										class="h-3.5 w-3.5"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
										<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
									</svg>
								</button>
							{:else}
								<div class="flex gap-1">
									<button
										class="btn btn-circle btn-ghost btn-xs"
										onclick={() => {
											editingStudyId = null;
											localEditStart = '';
											localEditEnd = '';
										}}
										aria-label="Cancel"
									>
										<svg
											class="h-3.5 w-3.5"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<path d="M18 6L6 18M6 6l12 12" />
										</svg>
									</button>
									<button
										class="btn btn-circle btn-xs btn-accent"
										disabled={studyDateError !== '' || !localEditStart || !localEditEnd}
										onclick={() => {
											if (studyDateError !== '' || !localEditStart || !localEditEnd) return;
											dispatch('saveStudyPeriod', {
												studyId: participantStudy.study_id,
												start: localEditStart,
												end: localEditEnd
											});
											editingStudyId = null;
											localEditStart = '';
											localEditEnd = '';
										}}
										aria-label="Save"
									>
										<svg
											class="h-3.5 w-3.5"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<polyline points="20 6 9 17 4 12" />
										</svg>
									</button>
								</div>
							{/if}
						</div>
						{#if editingStudyId === participantStudy.study_id.toString()}
							<div class="mt-2 flex items-center gap-2">
								<input
									class="input-bordered input input-xs flex-1"
									type="date"
									bind:value={localEditStart}
								/>
								<span class="text-xs text-base-content/30">to</span>
								<input
									class="input-bordered input input-xs flex-1"
									type="date"
									bind:value={localEditEnd}
									min={localEditStart || undefined}
								/>
							</div>
							{#if studyDateError}
								<p class="mt-1 font-mono text-xs text-error">{studyDateError}</p>
							{/if}
						{:else if participantStudy.membership_period}
							{@const parsedPeriod = formatMembershipPeriodDisplay(
								participantStudy.membership_period
							)}
							{#if parsedPeriod}
								<p class="mt-1.5 font-mono text-xs text-base-content/40">
									{parsedPeriod.start} — {parsedPeriod.end}
								</p>
							{:else}
								<p class="mt-1.5 font-mono text-xs text-error/60">Invalid period</p>
							{/if}
						{:else}
							<p class="mt-1.5 font-mono text-xs text-base-content/30">No period set</p>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
