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
		getSensors,
		getUserOwnerships,
		addOwnership,
		type Participant,
		type Sensor,
		type Ownership
	} from '$lib/api';
	import { onMount } from 'svelte';
	import AddParticipantModal from '$lib/assets/modals/AddParticipantModal.svelte';
	import AddStudyModal from '$lib/assets/modals/AddStudyModal.svelte';
	import AddToStudyModal from '$lib/assets/modals/AddToStudyModal.svelte';
	import AddDeviceModal from '$lib/assets/modals/AddDeviceModal.svelte';
	import ParticipantDetailsPanel from '$lib/assets/ParticipantDetailsPanel.svelte';

	let selectedParticipant: Participant | null = $state(null);
	let participants: Participant[] = $state([]);
	let studies: { id: number; name: string }[] = $state([]);
	let totalCount = $state(0);
	let isLoading = $state(false);
	let showDetailsPanel = $state(false);
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
		properties: { name: '', age: '', sex: '' }
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

	// Device management state
	let sensors: Sensor[] = $state([]);
	let showAddDeviceModal = $state(false);
	let newOwnership = $state({
		sensor_id: '',
		start_date: '',
		end_date: ''
	});

	// Sensor search state
	let sensorSearch = $state('');
	let showSensorDropdown = $state(false);
	let selectedSensorId = $state('');
	let focusedSensorIndex = $state(-1);

	// Filtered sensors for search
	let filteredSensors = $derived(
		sensors.filter((sensor) => {
			const searchLower = sensorSearch.toLowerCase();
			const nameMatch = sensor.name.toLowerCase().includes(searchLower);
			const propertyMatch =
				sensor.properties &&
				Object.values(sensor.properties).some((value) =>
					String(value).toLowerCase().includes(searchLower)
				);
			return nameMatch || propertyMatch;
		})
	);

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
	});

	// Reset page when page size changes
	$effect(() => {
		pageSize;
		currentPage = 1;
	});

	// Load participants when page changes
	$effect(() => {
		currentPage;
		loadParticipants();
	});

	// Sensor selection function
	const selectSensor = (sensor: Sensor) => {
		newOwnership.sensor_id = sensor.id.toString();
		sensorSearch = sensor.name;
		showSensorDropdown = false;
		focusedSensorIndex = -1;
		selectedSensorId = sensor.id.toString();
	};

	// Modal callback functions
	const onSensorSearchChange = (value: string) => {
		sensorSearch = value;
	};

	const onToggleDropdown = (show: boolean) => {
		showSensorDropdown = show;
	};

	const onFocusSensor = (index: number) => {
		focusedSensorIndex = index;
	};

	const openParticipant = async (participant: Participant) => {
		selectedParticipant = participant;
		showDetailsPanel = true;
	};

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

	// Load sensors
	const loadSensors = async () => {
		try {
			sensors = await getSensors();
		} catch (error) {
			console.error('Failed to load sensors:', error);
		}
	};

	onMount(async () => {
		await loadStudies();
		await loadSensors();
	});

	const handleAddUser = async (user: typeof newUser) => {
		let processedProperties: Record<string, any> = { ...user.properties };
		if (user.properties.age) {
			processedProperties.age = parseInt(user.properties.age);
		}

		await addParticipant({
			username: user.username,
			password: user.password,
			properties: processedProperties
		});
		showAddParticipantModal = false;
		newUser = { username: '', password: '', properties: { name: '', age: '', sex: '' } };
		await loadParticipants(); // Refresh the list
	};

	const handleAddToStudy = async (studyId: string, start: string, end: string) => {
		if (!selectedParticipant || !studyId) return;

		try {
			const membershipPeriod =
				start && end ? `[${start} 00:00:00, ${end} 23:59:59.99999999)` : null;

			await addParticipantToStudy(selectedParticipant.user_id, parseInt(studyId), membershipPeriod);

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

	const handleAddStudy = async (study: typeof newStudy) => {
		try {
			await addStudy(study);
			showAddStudyModal = false;
			newStudy = { name: '', activePeriodStart: '', activePeriodEnd: '' };
			await loadStudies(); // Refresh the studies list
			showToastMessage('Study added successfully', 'success');
		} catch (error) {
			console.error('Failed to add study:', error);
			showToastMessage('Failed to add study', 'error');
		}
	};

	const handleAddDevice = async (ownership: typeof newOwnership) => {
		if (
			!selectedParticipant ||
			!ownership.sensor_id ||
			!ownership.start_date ||
			!ownership.end_date
		) {
			showToastMessage('Please fill in all required fields', 'error');
			return;
		}

		try {
			await addOwnership({
				user_id: selectedParticipant.user_id,
				sensor_id: parseInt(ownership.sensor_id),
				start_date: ownership.start_date,
				end_date: ownership.end_date
			});

			showAddDeviceModal = false;
			newOwnership = { sensor_id: '', start_date: '', end_date: '' };
			sensorSearch = '';
			showSensorDropdown = false;
			selectedSensorId = '';
			focusedSensorIndex = -1;

			showToastMessage('Device added successfully', 'success');
		} catch (error) {
			console.error('Failed to add device:', error);
			showToastMessage('Failed to add device', 'error');
		}
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

	const handleEditParticipant = async (
		event: CustomEvent<{ user_id: string; properties: Record<string, any> }>
	) => {
		try {
			await updateParticipant(event.detail);

			// Update the selected participant and participants list
			if (selectedParticipant) {
				selectedParticipant.properties = event.detail.properties;

				const index = participants.findIndex((p) => p.user_id === event.detail.user_id);
				if (index !== -1) {
					participants[index].properties = event.detail.properties;
				}
			}

			showToastMessage('Participant updated successfully', 'success');
		} catch (error) {
			console.error('Failed to update participant:', error);
			showToastMessage('Failed to update participant', 'error');
		}
	};

	const handleEditStudyPeriod = async (
		event: CustomEvent<{ user_id: string; study_id: number; membership_period: string | null }>
	) => {
		try {
			await updateParticipantStudyPeriod(
				event.detail.user_id,
				event.detail.study_id,
				event.detail.membership_period
			);
			showToastMessage('Study period updated successfully', 'success');
		} catch (error) {
			console.error('Failed to update study period:', error);
			showToastMessage('Failed to update study period', 'error');
		}
	};

	const handleToast = (event: CustomEvent<{ message: string; type: 'success' | 'error' }>) => {
		showToastMessage(event.detail.message, event.detail.type);
	};

	const showToastMessage = (message: string, type: 'success' | 'error') => {
		toastMessage = message;
		toastType = type;
		showToast = true;
		setTimeout(() => {
			showToast = false;
		}, 3000);
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

				<div class="flex justify-end gap-2">
					<button class="btn btn-primary" onclick={() => (showAddParticipantModal = true)}>
						Add New Participant
					</button>
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

	<ParticipantDetailsPanel
		show={showDetailsPanel}
		{selectedParticipant}
		{studies}
		on:close={() => (showDetailsPanel = false)}
		on:addToStudy={async () => {
			showAddToStudyModal = true;
			if (selectedParticipant) {
				try {
					participantStudies = (await getParticipantStudies(
						selectedParticipant.user_id
					)) as unknown as {
						study_id: number;
						membership_period: string | null;
						studies: { id: number; name: string };
					}[];
				} catch (error) {
					console.error('Failed to load participant studies:', error);
				}
			}
		}}
		on:addDevice={() => {
			showAddDeviceModal = true;
			sensorSearch = '';
			showSensorDropdown = false;
			selectedSensorId = '';
			focusedSensorIndex = -1;
		}}
		on:editParticipant={handleEditParticipant}
		on:editStudyPeriod={handleEditStudyPeriod}
		on:toast={handleToast}
	/>

	<AddParticipantModal
		show={showAddParticipantModal}
		bind:newUser
		onAdd={handleAddUser}
		onClose={() => (showAddParticipantModal = false)}
	/>

	<AddToStudyModal
		show={showAddToStudyModal}
		bind:studyToAdd
		bind:studyStart
		bind:studyEnd
		{studies}
		{participantStudies}
		onAdd={handleAddToStudy}
		onClose={() => (showAddToStudyModal = false)}
	/>

	<!-- Add study modal -->
	<AddStudyModal
		show={showAddStudyModal}
		bind:newStudy
		onAdd={handleAddStudy}
		onClose={() => (showAddStudyModal = false)}
	/>

	<AddDeviceModal
		show={showAddDeviceModal}
		bind:newOwnership
		bind:sensorSearch
		{sensors}
		{filteredSensors}
		bind:showSensorDropdown
		bind:focusedSensorIndex
		onAdd={handleAddDevice}
		onClose={() => (showAddDeviceModal = false)}
		{onSensorSearchChange}
		onSelectSensor={selectSensor}
		{onToggleDropdown}
		{onFocusSensor}
	/>

	<!-- Toast notification -->
	{#if showToast}
		<div class="toast toast-start toast-bottom">
			<div class="alert {toastType === 'success' ? 'alert-success' : 'alert-error'}">
				<span>{toastMessage}</span>
			</div>
		</div>
	{/if}
</div>
