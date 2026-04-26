<script lang="ts">
	import {
		getParticipantStudies,
		getUserOwnerships,
		updateParticipant,
		updateParticipantStudyPeriod,
		type Participant,
		type Ownership
	} from '$lib/api';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		close: void;
		editParticipant: { user_id: string; properties: Record<string, any> };
		addToStudy: void;
		addDevice: void;
		editStudyPeriod: { user_id: number; study_id: number; membership_period: string | null };
		toast: { message: string; type: 'success' | 'error' };
	}>();

	interface Props {
		show: boolean;
		selectedParticipant: Participant | null;
		studies: { id: number; name: string }[];
	}

	let { show, selectedParticipant, studies }: Props = $props();

	let isEditing = $state(false);
	let editedProperties = $state({
		name: '',
		age: '',
		sex: ''
	});
	let participantStudies = $state<
		{ study_id: number; membership_period: string | null; studies: { id: number; name: string } }[]
	>([]);
	let userOwnerships = $state<any[]>([]);
	let editingStudyId = $state<string | null>(null);
	let currentEditStart = $state('');
	let currentEditEnd = $state('');

	// Load data when selectedParticipant changes
	$effect(() => {
		if (selectedParticipant) {
			isEditing = false;
			editedProperties = {
				name: (selectedParticipant.properties?.name as string) || '',
				age: (selectedParticipant.properties?.age as string) || '',
				sex: (selectedParticipant.properties?.sex as string) || ''
			};

			(async () => {
				try {
					participantStudies = (await getParticipantStudies(
						selectedParticipant.user_id
					)) as unknown as {
						study_id: number;
						membership_period: string | null;
						studies: { id: number; name: string };
					}[];

					userOwnerships = await getUserOwnerships(selectedParticipant.user_id);
				} catch (error) {
					console.error('Failed to load participant data:', error);
					dispatch('toast', { message: 'Failed to load participant data', type: 'error' });
				}
			})();
		}
	});

	const closeDetailsPanel = () => {
		dispatch('close');
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

		// Validation: name should contain only letters (including accented)
		const nameRegex = /^[a-zA-ZÀ-ž\s]+$/;
		if (editedProperties.name && !nameRegex.test(editedProperties.name.trim())) {
			dispatch('toast', { message: 'Name can only contain letters', type: 'error' });
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

	const startEditingStudy = (studyId: number, currentPeriod: string | null) => {
		editingStudyId = studyId.toString();
		// Initialize edit values from current data
		if (currentPeriod) {
			try {
				const parsed = JSON.parse(currentPeriod);
				if (Array.isArray(parsed) && parsed.length === 2) {
					currentEditStart = parsed[0].split(' ')[0];
					currentEditEnd = parsed[1].split(' ')[0];
				}
			} catch (e) {
				// Try the old regex format as fallback
				const match = currentPeriod.match(/\[([^,]+),\s*([^)]+)\)/);
				if (match) {
					currentEditStart = match[1].split(' ')[0];
					currentEditEnd = match[2].split(' ')[0];
				}
			}
		} else {
			currentEditStart = '';
			currentEditEnd = '';
		}
	};

	const cancelEditingStudy = () => {
		editingStudyId = null;
		currentEditStart = '';
		currentEditEnd = '';
	};

	const saveStudyPeriod = async (studyId: number) => {
		if (!selectedParticipant) return;

		try {
			const membershipPeriod =
				currentEditStart && currentEditEnd
					? `[${currentEditStart} 00:00:00, ${currentEditEnd} 23:59:59.99999999)`
					: null;

			dispatch('editStudyPeriod', {
				user_id: selectedParticipant.user_id,
				study_id: studyId,
				membership_period: membershipPeriod
			});

			cancelEditingStudy();
		} catch (error) {
			console.error('Failed to update study period:', error);
			dispatch('toast', { message: 'Failed to update study period', type: 'error' });
		}
	};
</script>

{#if show}
	<!-- Backdrop -->
	<button
		class="fixed inset-0 z-40 cursor-default bg-black/30"
		aria-label="Close details"
		onclick={closeDetailsPanel}
	></button>

	<!-- Right-side details panel -->
	<aside
		class="fixed top-0 right-0 z-50 h-full w-[500px] overflow-y-auto bg-base-100 p-6 shadow-2xl"
	>
		{#if selectedParticipant}
			<div class="max-w-full space-y-4">
				<!-- Header with edit button -->
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<h2 class="text-xl font-semibold">Participant Details</h2>
						<button class="btn btn-circle btn-ghost btn-sm" onclick={closeDetailsPanel}>✕</button>
					</div>
					<div class="flex flex-wrap gap-2">
						{#if !isEditing}
							<button class="btn btn-sm btn-primary" onclick={startEditing}> Edit </button>
							<button class="btn btn-sm btn-secondary" onclick={() => dispatch('addToStudy')}>
								Add to Study
							</button>
							<button class="btn btn-sm btn-accent" onclick={() => dispatch('addDevice')}>
								Add Device
							</button>
						{:else}
							<button class="btn btn-ghost btn-sm" onclick={cancelEditing}> Cancel </button>
							<button class="btn btn-sm btn-primary" onclick={saveParticipant}> Save </button>
						{/if}
					</div>
				</div>

				<!-- Editable fields -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<!-- Name -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Name</span>
						</label>
						{#if isEditing}
							<input
								class="input-bordered input input-sm"
								type="text"
								placeholder="Enter name"
								bind:value={editedProperties.name}
							/>
						{:else}
							<div class="stat-value text-lg break-all">
								{selectedParticipant.properties?.name ?? '—'}
							</div>
						{/if}
					</div>

					<!-- Age -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Age</span>
						</label>
						{#if isEditing}
							<input
								class="input-bordered input input-sm"
								type="number"
								placeholder="Age"
								min="1"
								max="120"
								bind:value={editedProperties.age}
							/>
						{:else}
							<div class="stat-value text-lg break-all">
								{selectedParticipant.properties?.age ?? '—'}
							</div>
						{/if}
					</div>

					<!-- Sex -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Sex</span>
						</label>
						{#if isEditing}
							<select class="select-bordered select select-sm" bind:value={editedProperties.sex}>
								<option value="" disabled>Select sex</option>
								<option value="male">Male</option>
								<option value="female">Female</option>
							</select>
						{:else}
							<div class="stat-value text-lg break-all">
								{selectedParticipant.properties?.sex ?? '—'}
							</div>
						{/if}
					</div>
				</div>

				<!-- Studies -->
				<div class="form-control">
					<div class="flex items-center justify-between">
						<label class="label">
							<span class="label-text">Studies</span>
						</label>
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
													onclick={() =>
														startEditingStudy(
															participantStudy.study_id,
															participantStudy.membership_period
														)}
												>
													Edit
												</button>
											{:else}
												<div class="flex gap-1">
													<button class="btn btn-ghost btn-xs" onclick={cancelEditingStudy}>
														Cancel
													</button>
													<button
														class="btn btn-xs btn-primary"
														onclick={() => saveStudyPeriod(participantStudy.study_id)}
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
													bind:value={currentEditStart}
												/>
												<span class="self-center text-xs text-base-content/70">to</span>
												<input
													class="input-bordered input input-xs flex-1"
													type="date"
													placeholder="End"
													bind:value={currentEditEnd}
												/>
											</div>
										{:else if participantStudy.membership_period}
											{@const parsedPeriod = (() => {
												try {
													const parsed = JSON.parse(participantStudy.membership_period);
													if (Array.isArray(parsed) && parsed.length === 2) {
														return {
															start: parsed[0].split(' ')[0], // Extract date part
															end: parsed[1].split(' ')[0] // Extract date part
														};
													}
												} catch (e) {
													// Try the old regex format as fallback
													const match =
														participantStudy.membership_period.match(/\[([^,]+),\s*([^)]+)\)/);
													if (match) {
														return {
															start: match[1].split(' ')[0],
															end: match[2].split(' ')[0]
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

				<!-- Devices -->
				<div class="form-control">
					<div class="flex items-center justify-between">
						<label class="label">
							<span class="label-text">Devices</span>
						</label>
					</div>
					<div class="mt-2">
						{#if userOwnerships.length === 0}
							<span class="text-base-content/70">No devices assigned</span>
						{:else}
							<div class="space-y-2">
								{#each userOwnerships as ownership}
									<div class="flex flex-col gap-1 rounded bg-base-200 p-2">
										<div class="flex items-center justify-between">
											<span class="badge badge-accent">{ownership.sensors?.name ?? 'Unknown'}</span>
										</div>
										<div class="text-xs text-base-content/70">
											<p>
												<strong>Description:</strong>
												{ownership.sensors?.description ?? '—'}
											</p>
											<p>
												<strong>Ownership Period:</strong>
												{ownership.start_date} to {ownership.end_date}
											</p>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- Read-only fields -->
				<div class="divider">Read-only Information</div>

				<div class="card bg-base-200">
					<div class="card-body p-4">
						<p>
							<span class="font-semibold">Username:</span>
							{selectedParticipant.username ?? '—'}
						</p>
						<p>
							<span class="font-semibold">Role:</span>
							{selectedParticipant.role ?? '—'}
						</p>
					</div>
				</div>
			</div>
		{:else}
			<div class="alert">
				<span>No participant selected.</span>
			</div>
		{/if}
	</aside>
{/if}
