<script lang="ts">
	import {
		getSensors,
		addSensor,
		updateSensor,
		getSensorStreams,
		getSensorOwnerships,
		getRecentObservations,
		type Sensor,
		type NewSensor,
		type DataStream,
		type SensorOwnership,
		type RecentObservation
	} from '$lib/api';
	import { showToast } from '$lib/stores/toast';
	import { onMount } from 'svelte';
	import AddSensorModal from '$lib/components/modals/AddSensorModal.svelte';
	import DeviceDetailsPanel from '$lib/components/DeviceDetailsPanel.svelte';
	import SensorStatusBadge from '$lib/components/SensorStatusBadge.svelte';

	let mounted = $state(false);
	onMount(() => setTimeout(() => (mounted = true), 50));

	// --- sensor list state ---
	let sensors = $state.raw<Sensor[]>([]);
	let totalCount = $state(0);
	let isLoadingSensors = $state(false);
	let currentPage = $state(1);
	let pageSize = $state(100);
	let filterSearch = $state('');
	let filterType = $state('all');
	let filterStatus = $state('all');
	let totalPages = $derived(Math.ceil(totalCount / pageSize) || 1);

	// --- panel state ---
	let selectedSensor = $state.raw<Sensor | null>(null);
	let showDetailsPanel = $state(false);
	let streams = $state.raw<DataStream[]>([]);
	let ownerships = $state.raw<SensorOwnership[]>([]);
	let recentObservations = $state.raw<RecentObservation[]>([]);

	// --- add sensor modal ---
	let showAddSensorModal = $state(false);
	let newSensor = $state<NewSensor>({
		name: '',
		sensor_type: 'ATMOTUBE_PRO',
		description: '',
		properties: { status: 'active' },
		credential_id: undefined
	});

	let showLoading = $derived(isLoadingSensors && sensors.length === 0);

	// --- distinct sensor types from the loaded list ---
	const sensorTypes = $derived(
		Array.from(new Set(sensors.map((s) => s.sensor_type).filter(Boolean)))
	);

	// --- client-side filter (mirrors /users) ---
	const filteredSensors = $derived(
		sensors.filter((sensor) => {
			const searchLower = filterSearch.toLowerCase().trim();
			if (searchLower) {
				const nameMatch = (sensor.name ?? '').toLowerCase().includes(searchLower);
				const descMatch = (sensor.description ?? '').toLowerCase().includes(searchLower);
				const propertyMatch =
					sensor.properties &&
					Object.values(sensor.properties).some((value) =>
						String(value).toLowerCase().includes(searchLower)
					);
				if (!nameMatch && !descMatch && !propertyMatch) return false;
			}
			if (filterType !== 'all' && sensor.sensor_type !== filterType) return false;
			if (filterStatus !== 'all') {
				const status = (sensor.properties?.status as string) ?? 'unknown';
				if (filterStatus === 'unknown') {
					if ((sensor.properties?.status as string | undefined) !== undefined) return false;
				} else if (status !== filterStatus) {
					return false;
				}
			}
			return true;
		})
	);

	const paginatedSensors = $derived(
		filteredSensors.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);

	const stats = $derived({
		total: totalCount,
		filtered: filteredSensors.length
	});

	// --- data loading ---
	async function loadSensors() {
		isLoadingSensors = true;
		try {
			const result = await getSensors();
			sensors = result;
			totalCount = result.length;
		} catch (error) {
			console.error('Failed to load sensors:', error);
			showToast('Failed to load sensors', 'error');
		} finally {
			isLoadingSensors = false;
		}
	}

	async function loadSensorDetails(sensorId: number) {
		try {
			const [s, o, r] = await Promise.all([
				getSensorStreams(sensorId),
				getSensorOwnerships(sensorId),
				getRecentObservations(sensorId)
			]);
			streams = s;
			ownerships = o;
			recentObservations = r;
		} catch (error) {
			console.error('Failed to load sensor details:', error);
			showToast('Failed to load device details', 'error');
		}
	}

	async function openSensor(sensor: Sensor) {
		selectedSensor = sensor;
		showDetailsPanel = true;
		await loadSensorDetails(sensor.id);
	}

	// --- pagination ---
	function goToPreviousPage() {
		if (currentPage > 1) currentPage--;
	}
	function goToNextPage() {
		if (currentPage < totalPages) currentPage++;
	}

	// --- filter / page changes reset to page 1 ---
	$effect(() => {
		filterSearch;
		filterType;
		filterStatus;
		pageSize;
		currentPage = 1;
	});

	$effect(() => {
		loadSensors();
	});

	// --- sensor CRUD handlers ---
	const handleAddSensor = async (sensor: NewSensor) => {
		try {
			await addSensor(sensor);
			showAddSensorModal = false;
			newSensor = {
				name: '',
				sensor_type: 'ATMOTUBE_PRO',
				description: '',
				properties: { status: 'active' },
				credential_id: undefined
			};
			await loadSensors();
			showToast('Device added successfully', 'success');
		} catch (error) {
			console.error('Failed to add sensor:', error);
			showToast('Failed to add device', 'error');
		}
	};

	const handleUpdateSensor = async (
		event: CustomEvent<{ id: number; changes: Partial<Sensor> }>
	) => {
		try {
			await updateSensor(event.detail.id, event.detail.changes);
			await loadSensors();
			const refreshed = sensors.find((s) => s.id === event.detail.id);
			if (refreshed) {
				selectedSensor = refreshed;
				// also refresh details so any new metadata/status is reflected
				await loadSensorDetails(selectedSensor.id);
			}
			showToast('Device updated successfully', 'success');
		} catch (error) {
			console.error('Failed to update sensor:', error);
			showToast('Failed to update device', 'error');
		}
	};

	// --- formatters (mirrors DeviceDetailsPanel) ---
	function formatRelativeTime(iso: string | null | undefined): string {
		if (!iso) return 'Never';
		const then = new Date(iso);
		if (isNaN(then.getTime())) return 'Never';
		const now = new Date();
		const diffMs = now.getTime() - then.getTime();
		const sec = Math.floor(diffMs / 1000);
		if (sec < 60) return 'just now';
		const min = Math.floor(sec / 60);
		if (min < 60) return `${min}m ago`;
		const hr = Math.floor(min / 60);
		if (hr < 24) return `${hr}h ago`;
		const day = Math.floor(hr / 24);
		if (day < 7) return `${day}d ago`;
		const week = Math.floor(day / 7);
		if (week < 4) return `${week}w ago`;
		const month = Math.floor(day / 30);
		if (month < 12) return `${month}mo ago`;
		const year = Math.floor(day / 365);
		return `${year}y ago`;
	}

	function getSensorStatus(properties: Record<string, unknown> | null | undefined): string {
		return (properties?.status as string) ?? 'unknown';
	}
</script>

<svelte:head>
	<title>Devices — OmniHub</title>
</svelte:head>

<div class="relative h-full w-full overflow-hidden bg-base-100">
	<div
		class="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent"
	></div>

	<div class="relative z-10 flex h-full flex-col gap-4 p-4 lg:p-6">
		<!-- =============================================================
		     🔴 TODO: Manjkajoči api.* view-i in GRANT-i (blokira funkcionalnost)
		     PATCH /sensors vrne 403 (manjka GRANT na api.sensors), Data Streams
		     card v sidebaru je prazen (api.data_streams view ne obstaja),
		     Ownerships card nima username/participant_name (api.users view
		     ne obstaja). Popravek: nova migracija z GRANT-i in view-i.
		     Podrobnosti: TODO.md, PLAN.md §10.1.
		     ============================================================= -->
		<div
			role="alert"
			class="alert alert-soft alert-error flex flex-col items-start gap-2 sm:flex-row sm:items-center"
		>
			<svg
				class="h-5 w-5 flex-none text-error"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="8" x2="12" y2="12" />
				<circle cx="12" cy="16" r="0.5" fill="currentColor" />
			</svg>
			<div class="min-w-0 flex-1">
				<h3 class="font-display text-sm font-semibold text-error">
					Stran /devices ni produkcijsko pripravljena — manjkajo api.* view-i in GRANT-i
				</h3>
				<p class="mt-1 font-mono text-xs text-base-content/70">
					Urejanje senzorjev (<code class="text-error">PATCH /sensors</code>) vrača
					<code class="text-error">403 Forbidden</code>, ker manjka
					<code class="text-error">GRANT SELECT,INSERT,UPDATE ON api.sensors TO admin</code>.
					Data Streams in Ownerships kartici v sidebaru sta prazni, ker view-a
					<code class="text-error">api.data_streams</code> in
					<code class="text-error">api.users</code> sploh ne obstajata.
				</p>
				<p class="mt-1 font-mono text-xs text-base-content/50">
					Popravek: dodaj novo migracijo
					<code class="text-base-content/70">22_views_and_grants.sql</code> (glej
					<code class="text-base-content/70">TODO.md</code> in
					<code class="text-base-content/70">PLAN.md §10.1</code>).
				</p>
			</div>
		</div>

		<div class="flex items-center justify-between {mounted ? 'animate-fade-in-up' : 'opacity-0'}">
			<div>
				<h1 class="font-display text-2xl font-bold">Devices</h1>
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
				<button onclick={() => (showAddSensorModal = true)} class="btn font-mono btn-primary">
					<svg
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M12 5v14M5 12h14" />
					</svg>
					Add Device
				</button>
			</div>
		</div>

		<div class="card bg-base-200 {mounted ? 'animate-fade-in-up stagger-1' : 'opacity-0'}">
			<div class="card-body p-4 lg:p-6">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
							placeholder="Search by name, description, metadata..."
							bind:value={filterSearch}
						/>
					</div>

					<div class="form-control">
						<label class="label" for="type-filter">
							<span
								class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
								>Sensor Type</span
							>
						</label>
						<select id="type-filter" class="select-bordered select w-full" bind:value={filterType}>
							<option value="all">All Types</option>
							{#each sensorTypes as t}
								<option value={t}>{t}</option>
							{/each}
						</select>
					</div>

					<div class="form-control">
						<label class="label" for="status-filter">
							<span
								class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
								>Status</span
							>
						</label>
						<select
							id="status-filter"
							class="select-bordered select w-full"
							bind:value={filterStatus}
						>
							<option value="all">All</option>
							<option value="active">Active</option>
							<option value="inactive">Inactive</option>
							<option value="maintenance">Maintenance</option>
							<option value="unknown">Unknown</option>
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
							<th class="font-mono text-xs tracking-wider text-base-content/40 uppercase">Name</th>
							<th class="font-mono text-xs tracking-wider text-base-content/40 uppercase"
								>Sensor Type</th
							>
							<th class="font-mono text-xs tracking-wider text-base-content/40 uppercase">Status</th
							>
							<th
								class="hidden font-mono text-xs tracking-wider text-base-content/40 uppercase md:table-cell"
								>Last Activity</th
							>
						</tr>
					</thead>
					<tbody>
						{#if isLoadingSensors && sensors.length === 0}
							<tr>
								<td colspan="4" class="py-12 text-center">
									<span class="loading loading-lg loading-spinner text-primary"></span>
									<span class="ml-2 font-mono text-base-content/50">Loading devices...</span>
								</td>
							</tr>
						{:else if paginatedSensors.length === 0}
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
											<rect x="2" y="6" width="20" height="12" rx="2" />
											<path d="M6 12h.01M12 12h.01" />
										</svg>
										<span class="font-mono text-sm">No devices found</span>
									</div>
								</td>
							</tr>
						{:else}
							{#each paginatedSensors as sensor (sensor.id)}
								<tr
									class="cursor-pointer transition-colors hover:bg-primary/5"
									onclick={() => openSensor(sensor)}
									role="button"
									tabindex="0"
								>
									<td>
										<div class="flex items-center gap-3">
											<div
												class="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-primary/10"
											>
												<svg
													class="h-4 w-4 text-primary"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
												>
													<rect x="2" y="6" width="20" height="12" rx="2" />
													<path d="M6 12h.01M12 12h.01" />
												</svg>
											</div>
											<div class="min-w-0">
												<span class="block truncate font-mono text-sm font-medium"
													>{sensor.name || '—'}</span
												>
												{#if sensor.description}
													<span class="block truncate text-xs text-base-content/40">
														{sensor.description}
													</span>
												{/if}
											</div>
										</div>
									</td>
									<td>
										{#if sensor.sensor_type}
											<span
												class="badge badge-soft font-mono text-[10px] tracking-wider uppercase badge-primary"
											>
												{sensor.sensor_type}
											</span>
										{:else}
											<span class="text-base-content/30">—</span>
										{/if}
									</td>
									<td>
										<SensorStatusBadge status={getSensorStatus(sensor.properties)} />
									</td>
									<td class="hidden md:table-cell">
										<span class="font-mono text-sm text-base-content/60">
											{formatRelativeTime(sensor.last_activity)}
										</span>
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
						disabled={currentPage === 1 || isLoadingSensors}
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
						disabled={currentPage >= totalPages || isLoadingSensors}
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

	<DeviceDetailsPanel
		show={showDetailsPanel}
		{selectedSensor}
		{ownerships}
		{streams}
		{recentObservations}
		on:close={() => (showDetailsPanel = false)}
		on:updateSensor={handleUpdateSensor}
	/>

	<AddSensorModal
		show={showAddSensorModal}
		bind:newSensor
		onAdd={handleAddSensor}
		onClose={() => (showAddSensorModal = false)}
	/>
</div>
