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
	import BulkDownloadModal from '$lib/components/modals/BulkDownloadModal.svelte';
	import BulkUploadModal from '$lib/components/modals/BulkUploadModal.svelte';
	import ParticipantDetailsPanel from '$lib/components/ParticipantDetailsPanel.svelte';
	import StudyBadges from '$lib/components/StudyBadges.svelte';
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
		// Reset to page 1 only if we are not already there. Svelte 5
		// detects the no-op write and does not re-run downstream effects
		// when the value is unchanged, but the explicit guard is clearer
		// and avoids any spurious pagination resets.
		if (currentPage !== 1) currentPage = 1;
		// Reset shift+click anchor — after a filter change the row
		// indices no longer refer to the same rows the user was looking
		// at, so any range select would be meaningless and could index
		// out of range.
		lastClickedIndex = null;
	});

	$effect(() => {
		currentPage;
		loadParticipants();
		// Same rationale as above — `lastClickedIndex` is meaningless
		// after a page change.
		lastClickedIndex = null;
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

	// Bulk-selection state. We use a Set<string> of user_ids. A Set is not
	// reactive in Svelte 5, so we always reassign a new Set on mutation.
	let selectedIds = $state(new Set<string>());
	// Index of the last clicked checkbox — used to compute shift+click ranges
	// over the currently-rendered (filtered, paginated) participant list.
	let lastClickedIndex = $state<number | null>(null);
	// `change` events from checkboxes do not expose the Shift modifier
	// state, so we track it via window-level key listeners and read it
	// in the click handler. Plain module-scope variable — not reactive.
	let shiftHeld = false;

	$effect(() => {
		if (typeof window === 'undefined') return;
		const onDown = (e: KeyboardEvent) => {
			if (e.key === 'Shift') shiftHeld = true;
		};
		const onUp = (e: KeyboardEvent) => {
			if (e.key === 'Shift') shiftHeld = false;
		};
		window.addEventListener('keydown', onDown);
		window.addEventListener('keyup', onUp);
		return () => {
			window.removeEventListener('keydown', onDown);
			window.removeEventListener('keyup', onUp);
		};
	});

	let showBulkDownloadModal = $state(false);
	let showBulkUploadModal = $state(false);
	let bulkDownloadPreselected = $state<string[]>([]);
	let bulkDownloadPreselectedStudy = $state<number | undefined>(undefined);

	// When the user paginates or filters, anything outside the current view
	// is still in the Set. We strip those ids out so the selection matches
	// what the admin sees in the table.
	$effect(() => {
		const visible = new Set(participants.map((p) => p.user_id));
		const filtered = new Set(Array.from(selectedIds).filter((id) => visible.has(id)));
		if (filtered.size !== selectedIds.size) {
			selectedIds = filtered;
		}
		// Reference `participants` so the effect re-runs on changes.
		void participants;
	});

	const allVisibleSelected = $derived(
		participants.length > 0 && participants.every((p) => selectedIds.has(p.user_id))
	);

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
		if (!study.name.trim()) {
			showToast('Please enter a study name', 'error');
			return;
		}
		if (!study.activePeriodStart || !study.activePeriodEnd) {
			showToast('Please choose both start and end dates', 'error');
			return;
		}
		if (study.activePeriodEnd < study.activePeriodStart) {
			showToast('End date must be on or after start date', 'error');
			return;
		}
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

		if (newOwnership.end_date < newOwnership.start_date) {
			showToast('End date must be on or after start date', 'error');
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

	// ---- Bulk selection -------------------------------------------------

	function handleRowCheckboxClick(_event: Event, index: number) {
		// `onchange` fires with a generic Event and does not expose the
		// Shift modifier, so we use the window-level `shiftHeld` flag
		// maintained by the keydown/keyup listeners above.
		const target = participants[index];
		if (!target) {
			// Defensive: stale index (e.g. lastClickedIndex was set on a
			// previous page) — silently bail.
			return;
		}
		const userId = target.user_id;
		const next = new Set(selectedIds);

		if (shiftHeld && lastClickedIndex !== null && lastClickedIndex !== index) {
			// Clamp the range to the visible window — if lastClickedIndex
			// is from a previous page (defense-in-depth against stale
			// state), we fall back to a single-row select.
			const safeStart = Math.max(0, Math.min(lastClickedIndex, index));
			const safeEnd = Math.min(participants.length - 1, Math.max(lastClickedIndex, index));
			if (safeStart > safeEnd) {
				next.add(userId);
			} else {
				for (let i = safeStart; i <= safeEnd; i++) {
					const row = participants[i];
					if (row) next.add(row.user_id);
				}
			}
		} else if (next.has(userId)) {
			next.delete(userId);
		} else {
			next.add(userId);
		}

		selectedIds = next;
		lastClickedIndex = index;
	}

	function toggleAllVisible() {
		if (allVisibleSelected) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(participants.map((p) => p.user_id));
		}
		lastClickedIndex = null;
	}

	function clearSelection() {
		selectedIds = new Set();
		lastClickedIndex = null;
	}

	function openBulkDownload() {
		// If the admin has selected rows, pre-select them. Otherwise open
		// the modal in "no preselection" mode and let them pick a study.
		bulkDownloadPreselected = Array.from(selectedIds);
		bulkDownloadPreselectedStudy = undefined;
		showBulkDownloadModal = true;
	}

	async function handleBulkImported() {
		// Refresh the participants list after a successful import so the
		// new users appear in the table without a manual reload.
		await loadParticipants();
		await loadStudies();
		clearSelection();
	}
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
				<div class="dropdown relative dropdown-end z-50">
					<div tabindex="0" role="button" class="btn font-mono btn-ghost" aria-label="Bulk actions">
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="17 8 12 3 7 8" />
							<line x1="12" y1="3" x2="12" y2="15" />
						</svg>
						Bulk Actions
						{#if selectedIds.size > 0}
							<span class="badge font-mono badge-sm badge-primary">{selectedIds.size}</span>
						{/if}
					</div>
					<ul
						tabindex="-1"
						class="dropdown-content menu mt-2 w-56 rounded-box border border-neutral/20 bg-base-100 p-2 font-mono shadow-lg"
					>
						<li>
							<button type="button" onclick={openBulkDownload}>
								<svg
									class="h-4 w-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
									<polyline points="7 10 12 15 17 10" />
									<line x1="12" y1="15" x2="12" y2="3" />
								</svg>
								<span>Bulk Download</span>
								{#if selectedIds.size > 0}
									<span class="ml-auto badge badge-xs badge-primary">{selectedIds.size}</span>
								{/if}
							</button>
						</li>
						<li>
							<button type="button" onclick={() => (showBulkUploadModal = true)}>
								<svg
									class="h-4 w-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
									<polyline points="17 8 12 3 7 8" />
									<line x1="12" y1="3" x2="12" y2="15" />
								</svg>
								<span>Bulk Upload</span>
							</button>
						</li>
					</ul>
				</div>
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

		{#if selectedIds.size > 0}
			<div
				class="flex items-center justify-between rounded-box border border-primary/30 bg-primary/5 px-4 py-2 font-mono text-sm {mounted
					? 'animate-fade-in-up stagger-2'
					: 'opacity-0'}"
			>
				<span class="text-primary">
					{selectedIds.size} selected
				</span>
				<button class="btn btn-ghost btn-xs" onclick={clearSelection}>Clear</button>
			</div>
		{/if}

		<div
			class="card min-h-0 flex-1 overflow-hidden bg-base-200 {mounted
				? 'animate-fade-in-up stagger-2'
				: 'opacity-0'}"
		>
			<div class="h-full overflow-x-auto">
				<table class="table">
					<thead class="bg-base-300/50">
						<tr>
							<th class="w-10">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									aria-label="Select all visible"
									checked={allVisibleSelected}
									indeterminate={!allVisibleSelected &&
										participants.some((p) => selectedIds.has(p.user_id))}
									onchange={toggleAllVisible}
								/>
							</th>
							<th class="font-mono text-xs tracking-wider text-base-content/40 uppercase"
								>Username</th
							>
							<th class="font-mono text-xs tracking-wider text-base-content/40 uppercase">Study</th>
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
							{#each participants as participant, index (participant.user_id)}
								{@const isSelected = selectedIds.has(participant.user_id)}
								<tr
									class="cursor-pointer transition-colors hover:bg-primary/5 {isSelected
										? 'bg-primary/10'
										: ''}"
									onclick={() => openParticipant(participant)}
									role="button"
									tabindex="0"
								>
									<td onclick={(e) => e.stopPropagation()}>
										<input
											type="checkbox"
											class="checkbox checkbox-sm"
											aria-label="Select {participant.username ?? participant.user_id}"
											checked={isSelected}
											onclick={(e) => e.stopPropagation()}
											onchange={(e) => handleRowCheckboxClick(e, index)}
										/>
									</td>
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
										{#if participant.studies.length === 0}
											<span class="text-base-content/30">—</span>
										{:else}
											<!--
												StudyBadges measures the available width with ResizeObserver and
												shows as many study badges as fit, collapsing the rest into a
												`+N` overflow chip. At least one study is always shown.
											-->
											<StudyBadges studies={participant.studies} />
										{/if}
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
		on:close={async () => {
			showDetailsPanel = false;
			// The drawer is the only place where participants can be added to
			// studies, have assignments changed, etc. After it closes, refetch
			// the participants list and the studies list so the table reflects
			// the new state without requiring a manual refresh.
			await Promise.all([loadParticipants(), loadStudies()]);
		}}
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

	<BulkDownloadModal
		show={showBulkDownloadModal}
		{studies}
		preselectedUserIds={bulkDownloadPreselected}
		preselectedStudyId={bulkDownloadPreselectedStudy}
		onClose={() => {
			showBulkDownloadModal = false;
			bulkDownloadPreselected = [];
			bulkDownloadPreselectedStudy = undefined;
		}}
	/>

	<BulkUploadModal
		show={showBulkUploadModal}
		{studies}
		onImported={handleBulkImported}
		onClose={() => (showBulkUploadModal = false)}
	/>
</div>
