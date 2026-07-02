<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { updateParticipant, type Participant, type Ownership } from '$lib/api';
	import { showToast } from '$lib/stores/toast';
	import { parseMembershipPeriod } from '$lib/utils/period';
	import PeriodBadge from './PeriodBadge.svelte';

	interface Props {
		show: boolean;
		selectedParticipant: Participant | null;
		studies: { id: number; name: string }[];
		participantStudies: {
			study_id: number;
			membership_period: string | null;
			studies: { id: number; name: string };
		}[];
		userOwnerships: Ownership[];
	}

	let { show, selectedParticipant, studies, participantStudies, userOwnerships }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		editParticipant: { user_id: string; properties: Record<string, unknown> };
		addToStudy: void;
		addDevice: void;
		changeStudyPeriod: {
			user_id: string;
			study_id: number;
			start: string;
			end: string;
		};
		changeOwnership: {
			user_id: string;
			sensor_id: number;
			old_start_date: string;
			old_end_date: string;
			new_start_date: string;
			new_end_date: string;
		};
	}>();

	let isEditing = $state(false);
	let editedProperties = $state({
		name: '',
		age: '',
		sex: ''
	});
	let panelVisible = $state(false);

	let editingStudyId = $state<string | null>(null);
	let editStudyStart = $state('');
	let editStudyEnd = $state('');

	let editingOwnershipKey = $state<string | null>(null);
	let editOwnershipStart = $state('');
	let editOwnershipEnd = $state('');

	$effect(() => {
		if (show) {
			panelVisible = true;
		} else {
			panelVisible = false;
			editingStudyId = null;
			editingOwnershipKey = null;
		}
	});

	$effect(() => {
		if (selectedParticipant) {
			panelVisible = true;
			isEditing = false;
			editedProperties = {
				name: (selectedParticipant.properties?.name as string) || '',
				age: (selectedParticipant.properties?.age as string) || '',
				sex: (selectedParticipant.properties?.sex as string) || ''
			};
			editingStudyId = null;
			editStudyStart = '';
			editStudyEnd = '';
			editingOwnershipKey = null;
			editOwnershipStart = '';
			editOwnershipEnd = '';
		}
	});

	const closeDetailsPanel = () => {
		panelVisible = false;
		setTimeout(() => dispatch('close'), 200);
	};

	const startEditing = () => {
		isEditing = true;
	};

	const cancelEditing = () => {
		if (selectedParticipant) {
			editedProperties = {
				name: (selectedParticipant.properties?.name as string) || '',
				age: (selectedParticipant.properties?.age as string) || '',
				sex: (selectedParticipant.properties?.sex as string) || ''
			};
		}
		isEditing = false;
	};

	const saveParticipant = () => {
		if (!selectedParticipant) return;

		const nameRegex = /^[a-zA-ZÀ-ž\s]+$/;
		if (editedProperties.name && !nameRegex.test(editedProperties.name.trim())) {
			showToast('Name can only contain letters', 'error');
			return;
		}

		dispatch('editParticipant', {
			user_id: selectedParticipant.user_id,
			properties: {
				...selectedParticipant.properties,
				name: editedProperties.name.trim() || null,
				age: editedProperties.age ? parseInt(editedProperties.age) : null,
				sex: editedProperties.sex || null
			}
		});

		isEditing = false;
	};

	const cancelEditStudy = () => {
		editingStudyId = null;
		editStudyStart = '';
		editStudyEnd = '';
	};

	const cancelEditOwnership = () => {
		editingOwnershipKey = null;
		editOwnershipStart = '';
		editOwnershipEnd = '';
	};

	const startEditStudy = (ps: { study_id: number; membership_period: string | null }) => {
		editingStudyId = ps.study_id.toString();
		if (ps.membership_period) {
			const parsed = parseMembershipPeriod(ps.membership_period);
			editStudyStart = parsed?.start ?? '';
			editStudyEnd = parsed?.end ?? '';
		} else {
			editStudyStart = '';
			editStudyEnd = '';
		}
	};

	const startEditOwnership = (ownership: Ownership) => {
		// extract YYYY-MM-DD from ISO timestamptz string
		const startDate = ownership.start_date.split('T')[0] || ownership.start_date.split(' ')[0];
		const endDate = ownership.end_date.split('T')[0] || ownership.end_date.split(' ')[0];
		editingOwnershipKey = `${ownership.sensor_id}|${ownership.start_date}`;
		editOwnershipStart = startDate;
		editOwnershipEnd = endDate;
	};

	const confirmChangeStudy = (studyId: number) => {
		if (!selectedParticipant) return;
		if (!editStudyStart || !editStudyEnd) {
			showToast('Please choose both start and end dates', 'error');
			return;
		}
		if (editStudyEnd < editStudyStart) {
			showToast('End date must be on or after start date', 'error');
			return;
		}
		dispatch('changeStudyPeriod', {
			user_id: selectedParticipant.user_id,
			study_id: studyId,
			start: editStudyStart,
			end: editStudyEnd
		});
		cancelEditStudy();
	};

	const confirmChangeOwnership = (ownership: Ownership) => {
		if (!selectedParticipant) return;
		if (!editOwnershipStart || !editOwnershipEnd) {
			showToast('Please choose both start and end dates', 'error');
			return;
		}
		if (editOwnershipEnd < editOwnershipStart) {
			showToast('End date must be on or after start date', 'error');
			return;
		}
		dispatch('changeOwnership', {
			user_id: selectedParticipant.user_id,
			sensor_id: ownership.sensor_id,
			old_start_date: ownership.start_date,
			old_end_date: ownership.end_date,
			new_start_date: editOwnershipStart,
			new_end_date: editOwnershipEnd
		});
		cancelEditOwnership();
	};
</script>

{#if show}
	<button
		class="fixed inset-0 z-40 cursor-default bg-black/50 backdrop-blur-sm transition-all duration-200 {panelVisible
			? 'opacity-100'
			: 'pointer-events-none opacity-0'}"
		aria-label="Close details"
		onclick={closeDetailsPanel}
	></button>

	<aside
		class="fixed top-0 right-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-neutral/20 bg-base-200 shadow-2xl transition-transform duration-200 ease-out {panelVisible
			? 'translate-x-0'
			: 'translate-x-full'}"
	>
		{#if selectedParticipant}
			<div class="sticky top-0 z-10 border-b border-neutral/20 bg-base-200">
				<div class="flex items-center justify-between p-4">
					<div class="flex items-center gap-3">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10"
						>
							<span class="font-display text-lg font-bold text-primary">
								{(
									(
										(selectedParticipant.properties?.name as string) ||
										selectedParticipant.username ||
										'U'
									).slice(0, 1) || 'U'
								).toUpperCase()}
							</span>
						</div>
						<div>
							<h2 class="font-display text-lg font-semibold">
								{(selectedParticipant.properties?.name as string) ||
									selectedParticipant.username ||
									'Participant Details'}
							</h2>
							<p class="font-mono text-xs text-base-content/40">
								@{selectedParticipant.username || 'unknown'}
							</p>
						</div>
					</div>
					<button
						class="btn btn-circle btn-ghost btn-sm"
						onclick={closeDetailsPanel}
						aria-label="Close panel"
					>
						<svg
							class="h-5 w-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<div class="space-y-6 p-4">
				<div class="card bg-base-300">
					<div class="card-body p-4">
						<div class="mb-4 flex items-center justify-between">
							<h3 class="font-mono text-xs tracking-wider text-base-content/40 uppercase">
								Personal Information
							</h3>
							{#if !isEditing}
								<button class="btn btn-sm btn-primary" onclick={startEditing}>
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
									Edit
								</button>
							{:else}
								<div class="flex gap-2">
									<button class="btn btn-ghost btn-sm" onclick={cancelEditing}>Cancel</button>
									<button class="btn btn-sm btn-primary" onclick={saveParticipant}>Save</button>
								</div>
							{/if}
						</div>

						<div class="grid grid-cols-3 gap-4">
							<div class="form-control">
								<label class="label" for="edit-name">
									<span
										class="label-text font-mono text-xs tracking-wider text-base-content/30 uppercase"
										>Name</span
									>
								</label>
								{#if isEditing}
									<input
										id="edit-name"
										class="input-bordered input input-sm w-full"
										type="text"
										placeholder="Enter name"
										bind:value={editedProperties.name}
									/>
								{:else}
									<p class="text-sm font-medium">{selectedParticipant.properties?.name ?? '—'}</p>
								{/if}
							</div>

							<div class="form-control">
								<label class="label" for="edit-age">
									<span
										class="label-text font-mono text-xs tracking-wider text-base-content/30 uppercase"
										>Age</span
									>
								</label>
								{#if isEditing}
									<input
										id="edit-age"
										class="input-bordered input input-sm w-full"
										type="number"
										placeholder="Age"
										min="1"
										max="120"
										bind:value={editedProperties.age}
									/>
								{:else}
									<p class="text-sm font-medium">{selectedParticipant.properties?.age ?? '—'}</p>
								{/if}
							</div>

							<div class="form-control">
								<label class="label" for="edit-sex">
									<span
										class="label-text font-mono text-xs tracking-wider text-base-content/30 uppercase"
										>Sex</span
									>
								</label>
								{#if isEditing}
									<select
										id="edit-sex"
										class="select-bordered select w-full select-sm"
										bind:value={editedProperties.sex}
									>
										<option value="" disabled>Select</option>
										<option value="male">Male</option>
										<option value="female">Female</option>
									</select>
								{:else}
									<p class="text-sm font-medium capitalize">
										{selectedParticipant.properties?.sex ?? '—'}
									</p>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<div class="card bg-base-300">
					<div class="card-body p-4">
						<div class="mb-4 flex items-center justify-between">
							<h3 class="font-mono text-xs tracking-wider text-base-content/40 uppercase">
								Studies
							</h3>
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
						</div>

						{#if participantStudies.length === 0}
							<div class="flex flex-col items-center justify-center py-4 text-base-content/30">
								<svg
									class="mb-2 h-8 w-8 opacity-30"
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
								{#each participantStudies as ps (ps.study_id)}
									<div class="rounded-lg bg-base-200 p-3">
										{#if editingStudyId === ps.study_id.toString()}
											<!-- EDIT MODE -->
											<div class="flex items-center gap-3">
												<div
													class="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-accent/20 bg-accent/10"
												>
													<svg
														class="h-4 w-4 text-accent"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
													>
														<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
														<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
													</svg>
												</div>
												<div class="min-w-0 flex-1">
													<span class="font-mono text-sm font-medium"
														>{ps.studies?.name ?? 'Unknown'}</span
													>
													<div class="mt-2 flex items-center gap-2">
														<input
															type="date"
															class="input-bordered input input-xs flex-1"
															bind:value={editStudyStart}
															aria-label="Edit start date"
														/>
														<span class="text-xs text-base-content/30">to</span>
														<input
															type="date"
															class="input-bordered input input-xs flex-1"
															bind:value={editStudyEnd}
															aria-label="Edit end date"
														/>
													</div>
													<div class="mt-2 flex items-center justify-end gap-1">
														<button
															class="btn btn-ghost btn-xs"
															onclick={cancelEditStudy}
															aria-label="Cancel edit"
														>
															Cancel
														</button>
														<button
															class="btn btn-xs btn-accent"
															onclick={() => confirmChangeStudy(ps.study_id)}
															aria-label="Save changes"
														>
															<svg
																class="h-3 w-3"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2"
															>
																<polyline points="20 6 9 17 4 12" />
															</svg>
															Change
														</button>
													</div>
												</div>
											</div>
										{:else}
											<!-- DISPLAY MODE -->
											<div class="flex items-center justify-between">
												<div class="flex items-center gap-3">
													<div
														class="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/20 bg-accent/10"
													>
														<svg
															class="h-4 w-4 text-accent"
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
														<span class="font-mono text-sm">{ps.studies?.name ?? 'Unknown'}</span>
														<div class="mt-0.5">
															<PeriodBadge period={ps.membership_period} />
														</div>
													</div>
												</div>
												<button
													class="btn btn-circle btn-ghost btn-xs"
													onclick={() => startEditStudy(ps)}
													aria-label="Edit study"
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
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<div class="card bg-base-300">
					<div class="card-body p-4">
						<div class="mb-4 flex items-center justify-between">
							<h3 class="font-mono text-xs tracking-wider text-base-content/40 uppercase">
								Devices
							</h3>
							<button class="btn btn-sm btn-warning" onclick={() => dispatch('addDevice')}>
								<svg
									class="h-3.5 w-3.5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M12 5v14M5 12h14" />
								</svg>
								Assign
							</button>
						</div>

						{#if userOwnerships.length === 0}
							<div class="flex flex-col items-center justify-center py-4 text-base-content/30">
								<svg
									class="mb-2 h-8 w-8 opacity-30"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
								>
									<rect x="2" y="6" width="20" height="12" rx="2" />
									<path d="M6 12h.01M12 12h.01" />
								</svg>
								<span class="font-mono text-xs">No devices assigned</span>
							</div>
						{:else}
							<div class="space-y-2">
								{#each userOwnerships as ownership (ownership.sensor_id)}
									<div class="rounded-lg bg-base-200 p-3">
										{#if editingOwnershipKey === `${ownership.sensor_id}|${ownership.start_date}`}
											<!-- EDIT MODE -->
											<div class="flex items-center gap-3">
												<div
													class="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-warning/20 bg-warning/10"
												>
													<svg
														class="h-4 w-4 text-warning"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
													>
														<rect x="2" y="6" width="20" height="12" rx="2" />
														<path d="M6 12h.01M12 12h.01" />
													</svg>
												</div>
												<div class="min-w-0 flex-1">
													<span class="font-mono text-sm font-medium"
														>{ownership.list_sensors?.name ?? 'Unknown'}</span
													>
													<div class="mt-2 flex items-center gap-2">
														<input
															type="date"
															class="input-bordered input input-xs flex-1"
															bind:value={editOwnershipStart}
															aria-label="Edit start date"
														/>
														<span class="text-xs text-base-content/30">to</span>
														<input
															type="date"
															class="input-bordered input input-xs flex-1"
															bind:value={editOwnershipEnd}
															aria-label="Edit end date"
														/>
													</div>
													<div class="mt-2 flex items-center justify-end gap-1">
														<button
															class="btn btn-ghost btn-xs"
															onclick={cancelEditOwnership}
															aria-label="Cancel edit"
														>
															Cancel
														</button>
														<button
															class="btn btn-xs btn-warning"
															onclick={() => confirmChangeOwnership(ownership)}
															aria-label="Save changes"
														>
															<svg
																class="h-3 w-3"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2"
															>
																<polyline points="20 6 9 17 4 12" />
															</svg>
															Change
														</button>
													</div>
												</div>
											</div>
										{:else}
											<!-- DISPLAY MODE -->
											<div class="flex items-center justify-between">
												<div class="flex items-center gap-3">
													<div
														class="flex h-8 w-8 items-center justify-center rounded-lg border border-warning/20 bg-warning/10"
													>
														<svg
															class="h-4 w-4 text-warning"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2"
														>
															<rect x="2" y="6" width="20" height="12" rx="2" />
															<path d="M6 12h.01M12 12h.01" />
														</svg>
													</div>
													<div>
														<span class="font-mono text-sm"
															>{ownership.list_sensors?.name ?? 'Unknown'}</span
														>
														<div class="mt-0.5">
															<PeriodBadge start={ownership.start_date} end={ownership.end_date} />
														</div>
													</div>
												</div>
												<button
													class="btn btn-circle btn-ghost btn-xs"
													onclick={() => startEditOwnership(ownership)}
													aria-label="Edit device"
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
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<div class="card bg-base-300">
					<div class="card-body p-4">
						<h3 class="mb-4 font-mono text-xs tracking-wider text-base-content/40 uppercase">
							Account Details
						</h3>
						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<span class="font-mono text-xs text-base-content/40">Username</span>
								<span class="font-mono text-sm text-primary"
									>@{selectedParticipant.username || '—'}</span
								>
							</div>
							<div class="flex items-center justify-between">
								<span class="font-mono text-xs text-base-content/40">Role</span>
								<span class="font-mono text-sm text-base-content/70"
									>{selectedParticipant.role ?? '—'}</span
								>
							</div>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div class="flex h-full items-center justify-center">
				<div class="text-center text-base-content/30">
					<svg
						class="mx-auto mb-3 h-12 w-12 opacity-30"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
						<circle cx="12" cy="7" r="4" />
					</svg>
					<p class="font-mono text-sm">No participant selected</p>
				</div>
			</div>
		{/if}
	</aside>
{/if}
