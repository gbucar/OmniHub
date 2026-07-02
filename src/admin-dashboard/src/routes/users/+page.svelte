<script lang="ts">
	import {
		addParticipant,
		addStudy,
		addOwnership,
		updateOwnership,
		getParticipantStudies,
		getStudies,
		getParticipants,
		addParticipantToStudy,
		updateParticipantStudyPeriod,
		updateParticipant,
		getSensors,
		getUserOwnerships,
		type Participant,
		type Sensor,
		type ParticipantStudy,
		type Study,
		type Ownership
	} from '$lib/api';
	import { showToast } from '$lib/stores/toast';
	import AddParticipantModal from '$lib/components/modals/AddParticipantModal.svelte';
	import AddStudyModal from '$lib/components/modals/AddStudyModal.svelte';
	import AddToStudyModal from '$lib/components/modals/AddToStudyModal.svelte';
	import AddDeviceModal from '$lib/components/modals/AddDeviceModal.svelte';
	import ParticipantDetailsPanel from '$lib/components/ParticipantDetailsPanel.svelte';
	import { onMount } from 'svelte';

	let mounted = $state(false);
	onMount(() => setTimeout(() => (mounted = true), 50));

	let participants = $state.raw<Participant[]>([]);
	let studies = $state.raw<Study[]>([]);
	let totalCount = $state(0);
	let isLoadingParticipants = $state(false);
	let isLoadingStudies = $state(false);
	let currentPage = $state(1);
	let pageSize = $state(100);
	let filterSearch = $state('');
	let filterStudy = $state('all');
	let totalPages = $derived(Math.ceil(totalCount / pageSize) || 1);

	async function loadParticipants() {
		isLoadingParticipants = true;
		try {
			const result = await getParticipants({
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
			isLoadingParticipants = false;
		}
	}

	async function loadStudies() {
		isLoadingStudies = true;
		try {
			studies = await getStudies();
		} catch (error) {
			console.error('Failed to load studies:', error);
		} finally {
			isLoadingStudies = false;
		}
	}

	function goToPreviousPage() {
		if (currentPage > 1) currentPage--;
	}

	function goToNextPage() {
		if (currentPage < totalPages) currentPage++;
	}

	$effect(() => {
		filterSearch;
		filterStudy;
		pageSize;
		currentPage = 1;
	});

	$effect(() => {
		currentPage;
		loadParticipants();
	});

	$effect(() => {
		loadStudies();
		loadSensors();
	});

	let showLoading = $derived(isLoadingParticipants && participants.length === 0);

	let selectedParticipant = $state.raw<Participant | null>(null);
	let showDetailsPanel = $state(false);
	let participantStudies = $state.raw<ParticipantStudy[]>([]);
	let userOwnerships = $state<Ownership[]>([]);

	let newUser = $state({
		username: '',
		password: '',
		properties: { name: '', age: '', sex: '' }
	});
	let showAddParticipantModal = $state(false);

	let showAddStudyModal = $state(false);
	let newStudy = $state({
		name: '',
		activePeriodStart: '',
		activePeriodEnd: ''
	});

	let showAddToStudyModal = $state(false);
	let studyToAdd = $state('');
	let studyStart = $state('');
	let studyEnd = $state('');

	let sensors = $state.raw<Sensor[]>([]);
	let showAddDeviceModal = $state(false);
	let newOwnership = $state({
		sensor_id: '',
		start_date: '',
		end_date: ''
	});

	let sensorSearch = $state('');
	let showSensorDropdown = $state(false);
	let focusedSensorIndex = $state(-1);

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

	async function loadSensors() {
		try {
			sensors = await getSensors();
		} catch (error) {
			console.error('Failed to load sensors:', error);
		}
	}

	async function loadUserOwnerships(userId: string) {
		try {
			userOwnerships = await getUserOwnerships(userId);
		} catch (error) {
			console.error('Failed to load ownerships:', error);
		}
	}

	async function loadParticipantStudies(userId: string) {
		try {
			participantStudies = await getParticipantStudies(userId);
		} catch (error) {
			console.error('Failed to load participant studies:', error);
		}
	}

	const selectSensor = (sensor: Sensor) => {
		newOwnership.sensor_id = sensor.id.toString();
		sensorSearch = sensor.name;
		showSensorDropdown = false;
		focusedSensorIndex = -1;
	};

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
		await loadParticipantStudies(participant.user_id);
		await loadUserOwnerships(participant.user_id);
	};

	const handleAddUser = async (user: typeof newUser) => {
		const processedProperties: Record<string, unknown> = { ...user.properties };
		if (user.properties.age) {
			processedProperties.age = parseInt(user.properties.age);
		}

		try {
			await addParticipant({
				username: user.username,
				password: user.password,
				properties: processedProperties
			});
			showAddParticipantModal = false;
			newUser = { username: '', password: '', properties: { name: '', age: '', sex: '' } };
			await loadParticipants();
			showToast('Participant added successfully', 'success');
		} catch (error) {
			console.error('Failed to add participant:', error);
			showToast('Failed to add participant', 'error');
		}
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

			await loadParticipantStudies(selectedParticipant.user_id);

			showToast('Participant added to study successfully', 'success');
		} catch (error) {
			console.error('Failed to add participant to study:', error);
			showToast('Failed to add participant to study', 'error');
		}
	};

	const handleAddStudy = async (study: typeof newStudy) => {
		try {
			await addStudy(study);
			showAddStudyModal = false;
			newStudy = { name: '', activePeriodStart: '', activePeriodEnd: '' };
			await loadStudies();
			showToast('Study added successfully', 'success');
		} catch (error) {
			console.error('Failed to add study:', error);
			showToast('Failed to add study', 'error');
		}
	};

	const handleAddDevice = async () => {
		if (
			!selectedParticipant ||
			!newOwnership.sensor_id ||
			!newOwnership.start_date ||
			!newOwnership.end_date
		) {
			showToast('Please fill in all required fields', 'error');
			return;
		}

		try {
			await addOwnership({
				user_id: selectedParticipant.user_id,
				sensor_id: parseInt(newOwnership.sensor_id),
				start_date: newOwnership.start_date,
				end_date: newOwnership.end_date
			});

			showAddDeviceModal = false;
			newOwnership = { sensor_id: '', start_date: '', end_date: '' };
			sensorSearch = '';
			showSensorDropdown = false;
			focusedSensorIndex = -1;

			await loadUserOwnerships(selectedParticipant.user_id);

			showToast('Device added successfully', 'success');
		} catch (error) {
			console.error('Failed to add device:', error);
			showToast('Failed to add device', 'error');
		}
	};

	const handleChangeStudyPeriod = async (
		event: CustomEvent<{
			user_id: string;
			study_id: number;
			start: string;
			end: string;
		}>
	) => {
		try {
			const membershipPeriod = `[${event.detail.start} 00:00:00, ${event.detail.end} 23:59:59.99999999)`;
			await updateParticipantStudyPeriod(
				event.detail.user_id,
				event.detail.study_id,
				membershipPeriod
			);
			await loadParticipantStudies(event.detail.user_id);
			showToast('Study period updated', 'success');
		} catch (error) {
			console.error('Failed to update study period:', error);
			showToast('Failed to update study period', 'error');
		}
	};

	const handleChangeOwnership = async (
		event: CustomEvent<{
			user_id: string;
			sensor_id: number;
			old_start_date: string;
			old_end_date: string;
			new_start_date: string;
			new_end_date: string;
		}>
	) => {
		try {
			await updateOwnership(
				event.detail.user_id,
				event.detail.sensor_id,
				event.detail.old_start_date,
				event.detail.old_end_date,
				event.detail.new_start_date,
				event.detail.new_end_date
			);
			await loadUserOwnerships(event.detail.user_id);
			showToast('Device assignment updated', 'success');
		} catch (error) {
			console.error('Failed to update ownership:', error);
			// Detect Postgres unique_violation (code 23505) — surfaced as Error message
			const msg = error instanceof Error ? error.message : String(error);
			if (msg.includes('23505') || msg.toLowerCase().includes('duplicate key')) {
				showToast('An assignment with these dates already exists for this device', 'error');
			} else {
				showToast('Failed to update device assignment', 'error');
			}
		}
	};

	const handleEditParticipant = async (
		event: CustomEvent<{ user_id: string; properties: Record<string, unknown> }>
	) => {
		try {
			await updateParticipant(event.detail);

			// Refetch the current page so the table row and the details panel
			// both reflect the new properties from the database. Using a fresh
			// reference for `selectedParticipant` is required because it is
			// declared with `$state.raw` (no deep proxy), so in-place mutation
			// of `.properties` would not trigger reactivity downstream.
			await loadParticipants();

			const refreshed = participants.find((p) => p.user_id === event.detail.user_id);
			if (refreshed) {
				selectedParticipant = refreshed;
			}

			showToast('Participant updated successfully', 'success');
		} catch (error) {
			console.error('Failed to update participant:', error);
			showToast('Failed to update participant', 'error');
		}
	};

	const stats = $derived({
		total: totalCount,
		filtered: participants.length
	});
</script>

<svelte:head>
	<title>Participants — OmniHub</title>
</svelte:head>

<div class="relative h-full w-full overflow-hidden bg-base-100">
	<div
		class="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent"
	></div>

	<div class="relative z-10 flex h-full flex-col gap-4 p-4 lg:p-6">
		<div class="flex items-center justify-between {mounted ? 'animate-fade-in-up' : 'opacity-0'}">
			<div>
				<h1 class="font-display text-2xl font-bold">Participants</h1>
				<p class="mt-1 font-mono text-sm text-base-content/50">
					{#if showLoading}
						<span class="loading loading-xs loading-spinner"></span>
						<span class="font-mono text-base-content/50">Loading...</span>
					{:else}
						<span class="text-primary">{stats.filtered}</span> of {stats.total} records
					{/if}
				</p>
			</div>

			<div class="flex items-center gap-3">
				<button onclick={() => (showAddStudyModal = true)} class="btn font-mono btn-ghost">
					<svg
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M12 5v14M5 12h14" />
					</svg>
					Add Study
				</button>
				<button onclick={() => (showAddParticipantModal = true)} class="btn font-mono btn-primary">
					<svg
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M12 5v14M5 12h14" />
					</svg>
					Add Participant
				</button>
			</div>
		</div>

		<div class="card bg-base-200 {mounted ? 'animate-fade-in-up stagger-1' : 'opacity-0'}">
			<div class="card-body p-4 lg:p-6">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					<div class="form-control">
						<label class="label" for="search">
							<span
								class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
								>Search</span
							>
						</label>
						<input
							id="search"
							class="input-bordered input w-full"
							type="text"
							placeholder="Search participants..."
							bind:value={filterSearch}
						/>
					</div>

					<div class="form-control">
						<label class="label" for="study-filter">
							<span
								class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
								>Study</span
							>
						</label>
						<select
							id="study-filter"
							class="select-bordered select w-full"
							bind:value={filterStudy}
						>
							<option value="all">All Studies</option>
							{#each studies as study}
								<option value={study.id.toString()}>{study.name}</option>
							{/each}
						</select>
					</div>

					<div class="form-control">
						<label class="label" for="page-size">
							<span
								class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
								>Records per page</span
							>
						</label>
						<select id="page-size" class="select-bordered select w-full" bind:value={pageSize}>
							<option value={10}>10</option>
							<option value={25}>25</option>
							<option value={50}>50</option>
							<option value={100}>100</option>
							<option value={500}>500</option>
						</select>
					</div>
				</div>
			</div>
		</div>

		<div
			class="card min-h-0 flex-1 overflow-hidden bg-base-200 {mounted
				? 'animate-fade-in-up stagger-2'
				: 'opacity-0'}"
		>
			<div class="h-full overflow-x-auto">
				<table class="table">
					<thead class="bg-base-300/50">
						<tr>
							<th class="font-mono text-xs tracking-wider text-base-content/40 uppercase"
								>Username</th
							>
							<th class="font-mono text-xs tracking-wider text-base-content/40 uppercase">Study</th>
							<th
								class="hidden font-mono text-xs tracking-wider text-base-content/40 uppercase md:table-cell"
								>Role</th
							>
							<th class="font-mono text-xs tracking-wider text-base-content/40 uppercase">Name</th>
						</tr>
					</thead>
					<tbody>
						{#if isLoadingParticipants && participants.length === 0}
							<tr>
								<td colspan="4" class="py-12 text-center">
									<span class="loading loading-lg loading-spinner text-primary"></span>
									<span class="ml-2 font-mono text-base-content/50">Loading participants...</span>
								</td>
							</tr>
						{:else if participants.length === 0}
							<tr>
								<td colspan="4" class="py-12 text-center">
									<div class="flex flex-col items-center gap-2 text-base-content/30">
										<svg
											class="h-12 w-12 opacity-30"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="1.5"
										>
											<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
											<circle cx="12" cy="7" r="4" />
										</svg>
										<span class="font-mono text-sm">No participants found</span>
									</div>
								</td>
							</tr>
						{:else}
							{#each participants as participant (participant.user_id)}
								<tr
									class="cursor-pointer transition-colors hover:bg-primary/5"
									onclick={() => openParticipant(participant)}
									role="button"
									tabindex="0"
								>
									<td>
										<div class="flex items-center gap-3">
											<div
												class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm text-primary"
											>
												{(participant.username?.[0] ?? 'U').toUpperCase()}
											</div>
											<span class="font-mono text-sm">{participant.username || '—'}</span>
										</div>
									</td>
									<td>
										{#if participant.study_name}
											<span class="badge badge-soft badge-primary">{participant.study_name}</span>
										{:else}
											<span class="text-base-content/30">—</span>
										{/if}
									</td>
									<td class="hidden md:table-cell">
										<span class="font-mono text-sm text-base-content/50"
											>{participant.role ?? '—'}</span
										>
									</td>
									<td>
										<span class="text-sm text-base-content/70"
											>{participant.properties?.name ?? '—'}</span
										>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>

			<div
				class="flex items-center justify-between border-t border-neutral/20 bg-base-200/50 px-4 py-3"
			>
				<span class="font-mono text-xs text-base-content/40">
					Page {currentPage} of {totalPages}
				</span>
				<div class="join">
					<button
						class="btn join-item btn-sm"
						onclick={goToPreviousPage}
						disabled={currentPage === 1 || isLoadingParticipants}
						aria-label="Previous page"
					>
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M15 18l-6-6 6-6" />
						</svg>
					</button>
					<button class="btn join-item cursor-default btn-sm">
						{currentPage} / {totalPages}
					</button>
					<button
						class="btn join-item btn-sm"
						onclick={goToNextPage}
						disabled={currentPage >= totalPages || isLoadingParticipants}
						aria-label="Next page"
					>
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M9 18l6-6-6-6" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	</div>

	<ParticipantDetailsPanel
		show={showDetailsPanel}
		{selectedParticipant}
		{studies}
		{participantStudies}
		{userOwnerships}
		on:close={() => (showDetailsPanel = false)}
		on:addToStudy={async () => {
			showAddToStudyModal = true;
			if (selectedParticipant) {
				await loadParticipantStudies(selectedParticipant.user_id);
			}
		}}
		on:addDevice={() => {
			showAddDeviceModal = true;
			sensorSearch = '';
			showSensorDropdown = false;
			focusedSensorIndex = -1;
		}}
		on:editParticipant={handleEditParticipant}
		on:changeStudyPeriod={handleChangeStudyPeriod}
		on:changeOwnership={handleChangeOwnership}
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
</div>
