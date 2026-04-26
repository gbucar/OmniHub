<script lang="ts">
	import {
		addParticipant,
		addStudy,
		getParicipants,
		getParticipantStudies,
		getStudies,
		updateParticipant,
		addParticipantToStudy,
		updateParticipantStudyPeriod,
		type Participant
	} from '$lib/api';
	import { onMount } from 'svelte';

	let selectedParticipant: Participant | null = $state(null);
	let participants: Participant[] = $state([]);
	let studies: { id: number; name: string }[] = $state([]);
	let totalCount = $state(0);
	let isLoading = $state(false);

	// Right-side details panel state
	let showDetailsPanel = $state(false);
	let isEditing = $state(false);
	let editedProperties = $state({
		name: '',
		age: '',
		sex: ''
	});
	let participantStudies = $state<
		{ study_id: number; membership_period: string | null; studies: { id: number; name: string } }[]
	>([]);

	// Toast notifications
	let toastMessage = $state('');
	let toastType = $state<'success' | 'error'>('success');
	let showToast = $state(false);

	// Existing create-user state kept intact
	let showAddParticipantModal = $state(false);
	let newUser = $state({
		username: '',
		password: '',
		properties: { name: '' }
	});

	// Add study state
	let showAddStudyModal = $state(false);
	let newStudy = $state({
		name: '',
		activePeriodStart: '',
		activePeriodEnd: ''
	});

	// Add participant to study
	let showAddToStudyModal = $state(false);
	let studyToAdd = $state('');
	let studyStart = $state('');
	let studyEnd = $state('');

	// Individual study editing state
	let editingStudyId = $state<string | null>(null);
	let studyEditValues = $state<{ [studyId: string]: { start: string; end: string } }>({});
	let currentEditStart = $state('');
	let currentEditEnd = $state('');

	// Filter state
	let filterSearch = $state('');
	let filterStudy = $state('all');

	// Pagination
	let currentPage = $state(1);
	let pageSize = $state(100);

	// Reset page when filters change
	$effect(() => {
		filterSearch;
		filterStudy;
		currentPage = 1;
		loadParticipants();
	});

	// Reset page when page size changes
	$effect(() => {
		pageSize;
		currentPage = 1;
		loadParticipants();
	});

	// Load participants with current filters
	const loadParticipants = async () => {
		isLoading = true;
		try {
			const result = await getParicipants({
				search: filterSearch || undefined,
				study: filterStudy !== 'all' ? filterStudy : undefined,
				limit: pageSize,
				offset: (currentPage - 1) * pageSize
			});
			participants = result.data;
			totalCount = result.count;
		} catch (error) {
			console.error('Failed to load participants:', error);
		} finally {
			isLoading = false;
		}
	};

	// Load studies
	const loadStudies = async () => {
		try {
			studies = await getStudies();
		} catch (error) {
			console.error('Failed to load studies:', error);
		}
	};

	onMount(async () => {
		await loadStudies();
		await loadParticipants();
	});

	const handleAddUser = async () => {
		await addParticipant(newUser);
		showAddParticipantModal = false;
		newUser = { username: '', password: '', properties: { name: '' } };
		await loadParticipants(); // Refresh the list
	};

	const handleAddToStudy = async () => {
		if (!selectedParticipant || !studyToAdd) return;

		try {
			const membershipPeriod =
				studyStart && studyEnd ? `[${studyStart} 00:00:00, ${studyEnd} 23:59:59.99999999)` : null;

			await addParticipantToStudy(
				selectedParticipant.user_id,
				parseInt(studyToAdd),
				membershipPeriod
			);

			showAddToStudyModal = false;
			studyToAdd = '';
			studyStart = '';
			studyEnd = '';

			// Refresh participant's studies
			participantStudies = (await getParticipantStudies(
				selectedParticipant.user_id
			)) as unknown as {
				study_id: number;
				membership_period: string | null;
				studies: { id: number; name: string };
			}[];

			showToastMessage('Participant added to study successfully', 'success');
		} catch (error) {
			console.error('Failed to add participant to study:', error);
			showToastMessage('Failed to add participant to study', 'error');
		}
	};

	const handleAddStudy = async () => {
		try {
			await addStudy(newStudy);
			showAddStudyModal = false;
			newStudy = { name: '', activePeriodStart: '', activePeriodEnd: '' };
			await loadStudies(); // Refresh the studies list
			showToastMessage('Study added successfully', 'success');
		} catch (error) {
			console.error('Failed to add study:', error);
			showToastMessage('Failed to add study', 'error');
		}
	};

	const openParticipant = async (participant: Participant) => {
		selectedParticipant = participant;
		isEditing = false;
		editedProperties = {
			name: (participant.properties?.name as string) || '',
			age: (participant.properties?.age as string) || '',
			sex: (participant.properties?.sex as string) || ''
		};

		// Load participant's studies
		try {
			participantStudies = (await getParticipantStudies(participant.user_id)) as unknown as {
				study_id: number;
				membership_period: string | null;
				studies: { id: number; name: string };
			}[];
		} catch (error) {
			console.error('Failed to load participant studies:', error);
			participantStudies = [];
		}

		showDetailsPanel = true;
	};

	const closeDetailsPanel = () => {
		showDetailsPanel = false;
		isEditing = false;
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

	const saveParticipant = async () => {
		if (!selectedParticipant) return;

		// Validation: name should contain only letters (including accented)
		const nameRegex = /^[a-zA-ZÀ-ž\s]+$/;
		if (editedProperties.name && !nameRegex.test(editedProperties.name.trim())) {
			showToastMessage('Name can only contain letters', 'error');
			return;
		}

		try {
			await updateParticipant({
				user_id: selectedParticipant.user_id,
				properties: {
					...selectedParticipant.properties,
					name: editedProperties.name.trim() || null,
					age: editedProperties.age ? parseInt(editedProperties.age) : null,
					sex: editedProperties.sex || null
				}
			});

			// Update the selected participant and participants list
			selectedParticipant.properties = {
				...selectedParticipant.properties,
				name: editedProperties.name.trim() || undefined,
				age: editedProperties.age ? parseInt(editedProperties.age) : undefined,
				sex: editedProperties.sex || undefined
			};

			// Update the participant in the list
			const index = participants.findIndex((p) => p.user_id === selectedParticipant!.user_id);
			if (index !== -1) {
				participants[index] = {
					...participants[index],
					properties: selectedParticipant!.properties
				};
			}

			isEditing = false;
			showToastMessage('Participant updated successfully', 'success');
		} catch (error) {
			console.error('Failed to update participant:', error);
			showToastMessage('Failed to update participant', 'error');
		}
	};

	const showToastMessage = (message: string, type: 'success' | 'error') => {
		toastMessage = message;
		toastType = type;
		showToast = true;
		setTimeout(() => {
			showToast = false;
		}, 3000);
	};

	const goToPreviousPage = async () => {
		if (currentPage > 1) {
			currentPage--;
			await loadParticipants();
		}
	};

	const goToNextPage = async () => {
		const maxPages = Math.ceil(totalCount / pageSize);
		if (currentPage < maxPages) {
			currentPage++;
			await loadParticipants();
		}
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
		studyEditValues = {};
	};

	const saveStudyPeriod = async (studyId: number) => {
		if (!selectedParticipant) return;

		try {
			const membershipPeriod =
				currentEditStart && currentEditEnd
					? `[${currentEditStart} 00:00:00, ${currentEditEnd} 23:59:59.99999999)`
					: null;

			await updateParticipantStudyPeriod(selectedParticipant.user_id, studyId, membershipPeriod);

			// Refresh the studies data
			participantStudies = (await getParticipantStudies(
				selectedParticipant.user_id
			)) as unknown as {
				study_id: number;
				membership_period: string | null;
				studies: { id: number; name: string };
			}[];

			cancelEditingStudy();
			showToastMessage('Study period updated successfully', 'success');
		} catch (error) {
			console.error('Failed to update study period:', error);
			showToastMessage('Failed to update study period', 'error');
		}
	};
</script>

<div class="relative h-full w-full bg-base-200">
	<div class="flex h-full flex-col gap-4 p-4">
		<!-- Filters  -->
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body p-4">
				<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
					<label class="form-control w-full">
						<div class="label">
							<span class="label-text">Search</span>
						</div>
						<input
							class="input-bordered input"
							type="text"
							placeholder="Search participants"
							bind:value={filterSearch}
						/>
					</label>

					<label class="form-control w-full">
						<div class="label">
							<span class="label-text">Study</span>
						</div>
						<select class="select-bordered select" bind:value={filterStudy}>
							<option value="all">All Studies</option>
							{#each studies as study}
								<option value={study.id.toString()}>{study.name}</option>
							{/each}
						</select>
					</label>
				</div>

				<div class="flex justify-end">
					<button class="btn btn-secondary" onclick={() => (showAddStudyModal = true)}>
						Add New Study
					</button>
				</div>
			</div>
		</div>

		<!-- Table + pagination -->
		<div class="card min-h-0 flex-1 bg-base-100 shadow-sm">
			<div class="card-body flex h-full min-h-0 flex-col p-0">
				<div class="min-h-0 flex-1 overflow-y-auto">
					<table class="table-pin-rows table">
						<thead>
							<tr>
								<th>Username</th>
								<th>Study</th>
								<th>Role</th>
								<th>Name</th>
							</tr>
						</thead>
						<tbody>
							{#if isLoading}
								<tr>
									<td colspan="4" class="py-10 text-center text-base-content/70">
										<span class="loading loading-lg loading-spinner"></span>
										<span class="ml-2">Loading participants...</span>
									</td>
								</tr>
							{:else if participants.length === 0}
								<tr>
									<td colspan="4" class="py-10 text-center text-base-content/70">
										No participants found.
									</td>
								</tr>
							{:else}
								{#each participants as participant, index}
									<tr
										class="hover cursor-pointer hover:bg-base-200"
										onclick={() => openParticipant(participant)}
									>
										<td>{participant.username ?? '—'}</td>
										<td>{participant.study_name ?? '—'}</td>
										<td>{participant.role ?? '—'}</td>
										<td>{participant.properties?.name ?? '—'}</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>

				<div class="border-t border-base-300 p-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="text-sm text-base-content/70">Records per page:</span>
							<select class="select-bordered select select-sm" bind:value={pageSize}>
								<option value={10}>10</option>
								<option value={25}>25</option>
								<option value={50}>50</option>
								<option value={100}>100</option>
								<option value={500}>500</option>
							</select>
						</div>

						<div class="join">
							<button
								class="btn join-item"
								onclick={goToPreviousPage}
								disabled={currentPage === 1 || isLoading}
							>
								«
							</button>
							<button class="btn join-item">
								Page {currentPage} / {Math.ceil(totalCount / pageSize) || 1}
							</button>
							<button
								class="btn join-item"
								onclick={goToNextPage}
								disabled={currentPage >= Math.ceil(totalCount / pageSize) || isLoading}
							>
								»
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Backdrop + right-side details panel -->
	{#if showDetailsPanel}
		<button
			class="fixed inset-0 z-40 cursor-default bg-black/30"
			aria-label="Close details"
			onclick={closeDetailsPanel}
		></button>

		<aside
			class="fixed top-0 right-0 z-50 h-full w-full max-w-md overflow-y-auto bg-base-100 p-6 shadow-2xl"
		>
			{#if selectedParticipant}
				<div class="space-y-4">
					<!-- Header with edit button -->
					<div class="flex items-center justify-between">
						<h2 class="text-xl font-semibold">Participant Details</h2>
						<div class="flex gap-2">
							{#if !isEditing}
								<button class="btn btn-sm btn-primary" onclick={startEditing}> Edit </button>
								<button
									class="btn btn-sm btn-secondary"
									onclick={() => (showAddToStudyModal = true)}
								>
									Add to Study
								</button>
							{:else}
								<button class="btn btn-ghost btn-sm" onclick={cancelEditing}> Cancel </button>
								<button class="btn btn-sm btn-primary" onclick={saveParticipant}> Save </button>
							{/if}
							<button class="btn btn-circle btn-ghost btn-sm" onclick={closeDetailsPanel}>✕</button>
						</div>
					</div>

					<!-- Editable fields -->
					<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
						<!-- Name -->
						<div class="form-control">
							<label class="label">
								<span class="label-text">Name</span>
							</label>
							{#if isEditing}
								<input
									class="input-bordered input"
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
									class="input-bordered input"
									type="number"
									placeholder="Enter age"
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
								<select class="select-bordered select" bind:value={editedProperties.sex}>
									<option value="">Select sex</option>
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

	<!-- Optional add participant modal -->
	{#if showAddParticipantModal}
		<div class="modal-open modal">
			<div class="modal-box">
				<h3 class="text-lg font-bold">Add Participant</h3>
				<div class="mt-4 space-y-3">
					<label class="form-control">
						<div class="label"><span class="label-text">Username</span></div>
						<input class="input-bordered input" bind:value={newUser.username} />
					</label>

					<label class="form-control">
						<div class="label"><span class="label-text">Password</span></div>
						<input class="input-bordered input" type="password" bind:value={newUser.password} />
					</label>

					<label class="form-control">
						<div class="label"><span class="label-text">Name</span></div>
						<input class="input-bordered input" bind:value={newUser.properties.name} />
					</label>
				</div>
				<div class="modal-action">
					<button class="btn" onclick={() => (showAddParticipantModal = false)}>Cancel</button>
					<button class="btn btn-primary" onclick={handleAddUser}>Save</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Add to study modal -->
	{#if showAddToStudyModal}
		<div class="modal-open modal">
			<div class="modal-box">
				<h3 class="text-lg font-bold">Add Participant to Study</h3>
				<div class="mt-4 space-y-3">
					<label class="form-control">
						<div class="label"><span class="label-text">Select Study</span></div>
						<select class="select-bordered select" bind:value={studyToAdd}>
							<option value="">Select a study</option>
							{#each studies as study}
								<option value={study.id.toString()}>{study.name}</option>
							{/each}
						</select>
					</label>

					<label class="form-control">
						<div class="label"><span class="label-text">Membership Start Date</span></div>
						<input class="input-bordered input" type="date" bind:value={studyStart} />
					</label>

					<label class="form-control">
						<div class="label"><span class="label-text">Membership End Date</span></div>
						<input class="input-bordered input" type="date" bind:value={studyEnd} />
					</label>
				</div>
				<div class="modal-action">
					<button class="btn" onclick={() => (showAddToStudyModal = false)}>Cancel</button>
					<button class="btn btn-primary" onclick={handleAddToStudy}>Add</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Add study modal -->
	{#if showAddStudyModal}
		<div class="modal-open modal">
			<div class="modal-box">
				<h3 class="text-lg font-bold">Add New Study</h3>
				<div class="mt-4 space-y-3">
					<label class="form-control">
						<div class="label"><span class="label-text">Study Name</span></div>
						<input
							class="input-bordered input"
							bind:value={newStudy.name}
							placeholder="Enter study name"
						/>
					</label>

					<label class="form-control">
						<div class="label"><span class="label-text">Active Period Start Date</span></div>
						<input
							class="input-bordered input"
							type="date"
							bind:value={newStudy.activePeriodStart}
						/>
					</label>

					<label class="form-control">
						<div class="label"><span class="label-text">Active Period End Date</span></div>
						<input class="input-bordered input" type="date" bind:value={newStudy.activePeriodEnd} />
					</label>
				</div>
				<div class="modal-action">
					<button class="btn" onclick={() => (showAddStudyModal = false)}>Cancel</button>
					<button class="btn btn-primary" onclick={handleAddStudy}>Add Study</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Toast notification -->
	{#if showToast}
		<div class="toast toast-start toast-bottom">
			<div class="alert {toastType === 'success' ? 'alert-success' : 'alert-error'}">
				<span>{toastMessage}</span>
			</div>
		</div>
	{/if}
</div>
