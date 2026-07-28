<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		type Sensor,
		type DataStream,
		type SensorOwnership,
		type RecentObservation
	} from '$lib/api';
	import { showToast } from '$lib/stores/toast';
	import PeriodBadge from './PeriodBadge.svelte';
	import SensorStatusBadge from './SensorStatusBadge.svelte';
	import DeviceMetadataEditor from './DeviceMetadataEditor.svelte';

	/**
	 * Right-side slide-in sidebar showing details of a selected sensor.
	 *
	 * The parent owns the data and the API calls — this component is a
	 * presentation + editing shell. It never mutates `selectedSensor` (the
	 * parent declares it with `$state.raw`) and never calls the API
	 * directly. The only mutation surface is the Information card, which
	 * dispatches `updateSensor` with a `Partial<Sensor>` diff on save.
	 *
	 * The Ownerships card is read-only by design — device→participant
	 * assignment is managed from the Participants page (`/users`) so the
	 * Devices page stays a pure "browse & configure device" surface.
	 *
	 * Edit lifecycle:
	 *   1. User clicks Edit → `startEditing()` populates `editedFields` /
	 *      `editedMetadata` from the current sensor.
	 *   2. User clicks Save → `saveSensor()` dispatches `updateSensor` with
	 *      the diff. The parent re-fetches the sensor and re-passes it in.
	 *   3. `selectedSensor` changing resets `editedFields` / `editedMetadata`
	 *      to mirror the new source of truth.
	 */
	interface Props {
		show: boolean;
		selectedSensor: Sensor | null;
		ownerships: SensorOwnership[];
		streams: DataStream[];
		recentObservations: RecentObservation[];
	}

	let { show, selectedSensor, ownerships, streams, recentObservations }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		updateSensor: { id: number; changes: Partial<Sensor> };
	}>();

	// --- SUGGESTED_TYPES: the four IOT models we see in `99_populate.sql`.
	// Users can still type a custom value via the "Other..." free-input combo.
	const SUGGESTED_TYPES = ['ATMOTUBE_PRO', 'ATMOAIR_PRO', 'ATMODOT_PRO', 'ATMOAIR_V2'];

	// --- local edit state ---
	let isEditing = $state(false);
	let panelVisible = $state(false);

	let editedFields = $state({
		name: '',
		sensor_type: '',
		description: '',
		status: 'active',
		credential_id: '' as number | ''
	});
	// Working copy of properties minus the reserved `status` key. The
	// `DeviceMetadataEditor` is the single source of truth for what's
	// in here; we just hold the object identity for two-way binding.
	let editedMetadata = $state<Record<string, unknown>>({});
	let customType = $state('');

	// The select shows "Other..." whenever the current sensor_type isn't
	// one of the predefined options (either on first load or after the
	// user picks "Other..." in this session).
	const showCustomTypeInput = $derived(
		editedFields.sensor_type !== '' && !SUGGESTED_TYPES.includes(editedFields.sensor_type)
	);

	// --- slide-in animation, mirrors ParticipantDetailsPanel ---
	$effect(() => {
		if (show) {
			// Defer to the next task so the browser paints the initial
			// translate-x-full position first, then animates the slide-in.
			setTimeout(() => (panelVisible = true), 0);
		} else {
			panelVisible = false;
		}
	});

	// Re-seed the form whenever the parent swaps the active sensor.
	$effect(() => {
		if (selectedSensor) {
			// Same pattern: let the panel render first, then slide in.
			setTimeout(() => (panelVisible = true), 0);
			isEditing = false;
			seedFromSensor(selectedSensor);
		}
	});

	// When in custom-type mode, keep sensor_type in sync with the free-input
	// field. We re-assign the whole object so the change is observable to
	// downstream derivations / binds.
	$effect(() => {
		if (showCustomTypeInput) {
			editedFields = { ...editedFields, sensor_type: customType };
		}
	});

	// --- helpers ---
	const seedFromSensor = (s: Sensor) => {
		const props = (s.properties ?? {}) as Record<string, unknown>;
		editedFields = {
			name: s.name ?? '',
			sensor_type: s.sensor_type ?? '',
			description: s.description ?? '',
			status: (props.status as string) ?? 'active',
			credential_id: (s.credential_id ?? '') as number | ''
		};
		customType = s.sensor_type && !SUGGESTED_TYPES.includes(s.sensor_type) ? s.sensor_type : '';
		// Metadata excludes the reserved `status` key (DeviceMetadataEditor
		// would strip it on its own, but we keep the local copy clean too).
		const next: Record<string, unknown> = {};
		for (const k of Object.keys(props)) {
			if (k !== 'status') next[k] = props[k];
		}
		editedMetadata = next;
	};

	const closeDetailsPanel = () => {
		panelVisible = false;
		setTimeout(() => dispatch('close'), 200);
	};

	const startEditing = () => {
		if (selectedSensor) seedFromSensor(selectedSensor);
		isEditing = true;
	};

	const cancelEditing = () => {
		if (selectedSensor) seedFromSensor(selectedSensor);
		isEditing = false;
	};

	const saveSensor = () => {
		if (!selectedSensor) return;
		const trimmedName = editedFields.name.trim();
		if (!trimmedName) {
			showToast('Name is required', 'error');
			return;
		}
		if (!editedFields.sensor_type.trim()) {
			showToast('Sensor type is required', 'error');
			return;
		}

		// Build the diff: top-level fields + merged `properties` (status +
		// user-edited metadata). We never send `id` / `sys_created_at` /
		// `last_activity` — the server owns those.
		const properties: Record<string, unknown> = {
			...editedMetadata,
			status: editedFields.status
		};
		const changes: Partial<Sensor> = {
			name: trimmedName,
			sensor_type: editedFields.sensor_type.trim(),
			description: editedFields.description.trim() || undefined,
			credential_id:
				editedFields.credential_id === '' || editedFields.credential_id === undefined
					? undefined
					: Number(editedFields.credential_id),
			properties
		};

		dispatch('updateSensor', { id: selectedSensor.id, changes });
		isEditing = false;
	};

	const onTypeSelect = (value: string) => {
		if (value === '__custom__') {
			customType = '';
			editedFields = { ...editedFields, sensor_type: '' };
		} else {
			editedFields = { ...editedFields, sensor_type: value };
			customType = '';
		}
	};

	// --- formatters ---
	const STATUS_OPTIONS = [
		{ value: 'active', label: 'Active' },
		{ value: 'inactive', label: 'Inactive' },
		{ value: 'maintenance', label: 'Maintenance' }
	];

	/**
	 * Human-friendly relative time. "Never" for null, "just now" / "2m
	 * ago" / "3h ago" / "5d ago" / "2w ago" / "1mo ago" / "1y ago" for
	 * recent dates, "Jan 1, 2026" for anything older than ~a year.
	 */
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

	/**
	 * Compact ISO -> "YYYY-MM-DD HH:MM" formatter for the observations
	 * mini-table. Truncates the input to 16 chars (the prefix of any
	 * ISO-like timestamptz) and replaces the 'T' separator with a space.
	 */
	const formatPhenomenonTime = (raw: string): string => {
		if (!raw) return '—';
		return raw.slice(0, 16).replace('T', ' ');
	};

	// user_id: 'user-abc' / '00000000-...' → first letter for the avatar
	const avatarInitial = (ownership: SensorOwnership): string => {
		const seed =
			ownership.participant_name ||
			(ownership.username ? '@' + ownership.username : null) ||
			ownership.user_id ||
			'?';
		return seed.slice(0, 1).toUpperCase();
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
		{#if selectedSensor}
			<!-- Sticky header: device icon, name, type badge, close button -->
			<div class="sticky top-0 z-10 border-b border-neutral/20 bg-base-200">
				<div class="flex items-center justify-between p-4">
					<div class="flex items-center gap-3">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10"
						>
							<svg
								class="h-5 w-5 text-primary"
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
							<h2 class="font-display text-lg font-semibold">
								{selectedSensor.name || 'Device Details'}
							</h2>
							{#if selectedSensor.sensor_type}
								<div class="mt-0.5">
									<span
										class="badge badge-soft font-mono text-[10px] tracking-wider uppercase badge-primary"
									>
										{selectedSensor.sensor_type}
									</span>
								</div>
							{/if}
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
				<!-- =============================================================
				     Card 1: Information
				     ============================================================= -->
				<div class="card bg-base-300">
					<div class="card-body p-4">
						<div class="mb-4 flex items-center justify-between">
							<h3 class="font-mono text-xs tracking-wider text-base-content/40 uppercase">
								Information
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
									<button class="btn btn-sm btn-primary" onclick={saveSensor}>Save</button>
								</div>
							{/if}
						</div>

						{#if isEditing}
							<!-- EDIT MODE -->
							<div class="grid grid-cols-2 gap-4">
								<div class="form-control col-span-2">
									<label class="label" for="edit-sensor-name">
										<span
											class="label-text font-mono text-xs tracking-wider text-base-content/30 uppercase"
											>Name</span
										>
									</label>
									<input
										id="edit-sensor-name"
										class="input-bordered input input-sm w-full"
										type="text"
										placeholder="Enter name"
										bind:value={editedFields.name}
									/>
								</div>

								<div class="form-control col-span-2">
									<label class="label" for="edit-sensor-type">
										<span
											class="label-text font-mono text-xs tracking-wider text-base-content/30 uppercase"
											>Sensor Type</span
										>
									</label>
									<select
										id="edit-sensor-type"
										class="select-bordered select w-full select-sm"
										value={showCustomTypeInput ? '__custom__' : editedFields.sensor_type}
										onchange={(e) => onTypeSelect((e.currentTarget as HTMLSelectElement).value)}
									>
										<option value="" disabled>Select a type</option>
										{#each SUGGESTED_TYPES as t}
											<option value={t}>{t}</option>
										{/each}
										<option value="__custom__">Other...</option>
									</select>
									{#if showCustomTypeInput}
										<input
											class="input-bordered input input-sm mt-2 w-full font-mono"
											placeholder="Custom type identifier"
											bind:value={customType}
										/>
									{/if}
								</div>

								<div class="form-control">
									<label class="label" for="edit-sensor-status">
										<span
											class="label-text font-mono text-xs tracking-wider text-base-content/30 uppercase"
											>Status</span
										>
									</label>
									<select
										id="edit-sensor-status"
										class="select-bordered select w-full select-sm"
										bind:value={editedFields.status}
									>
										{#each STATUS_OPTIONS as opt}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
								</div>

								<div class="form-control">
									<label class="label" for="edit-sensor-credential">
										<span
											class="label-text font-mono text-xs tracking-wider text-base-content/30 uppercase"
											>Credential ID</span
										>
									</label>
									<input
										id="edit-sensor-credential"
										type="number"
										min="0"
										step="1"
										class="input-bordered input input-sm w-full font-mono"
										placeholder="Optional"
										bind:value={editedFields.credential_id}
									/>
								</div>

								<div class="form-control col-span-2">
									<label class="label" for="edit-sensor-description">
										<span
											class="label-text font-mono text-xs tracking-wider text-base-content/30 uppercase"
											>Description</span
										>
									</label>
									<textarea
										id="edit-sensor-description"
										class="textarea-bordered textarea w-full"
										placeholder="Optional notes about this sensor"
										rows="2"
										bind:value={editedFields.description}
									></textarea>
								</div>

								<div class="form-control col-span-2">
									<span
										class="mb-1 block font-mono text-xs tracking-wider text-base-content/30 uppercase"
										>Metadata</span
									>
									<DeviceMetadataEditor bind:metadata={editedMetadata} />
								</div>
							</div>
						{:else}
							<!-- DISPLAY MODE -->
							<div class="space-y-3">
								<div class="flex items-center justify-between">
									<span class="font-mono text-xs text-base-content/40">Name</span>
									<span class="font-mono text-sm font-medium">{selectedSensor.name || '—'}</span>
								</div>
								<div class="flex items-center justify-between">
									<span class="font-mono text-xs text-base-content/40">Sensor type</span>
									{#if selectedSensor.sensor_type}
										<span
											class="badge badge-soft font-mono text-[10px] tracking-wider uppercase badge-primary"
										>
											{selectedSensor.sensor_type}
										</span>
									{:else}
										<span class="font-mono text-sm text-base-content/40">—</span>
									{/if}
								</div>
								<div class="flex items-center justify-between">
									<span class="font-mono text-xs text-base-content/40">Status</span>
									<SensorStatusBadge
										status={(selectedSensor.properties?.status as string) ?? 'active'}
									/>
								</div>
								<div class="flex items-center justify-between">
									<span class="font-mono text-xs text-base-content/40">Last activity</span>
									<span class="font-mono text-sm text-base-content/70">
										{formatRelativeTime(selectedSensor.last_activity)}
									</span>
								</div>
								<div class="flex items-center justify-between">
									<span class="font-mono text-xs text-base-content/40">Credential ID</span>
									<span class="font-mono text-sm text-base-content/70">
										{selectedSensor.credential_id ?? '—'}
									</span>
								</div>
								{#if selectedSensor.description}
									<div class="pt-2">
										<span class="font-mono text-xs tracking-wider text-base-content/30 uppercase"
											>Description</span
										>
										<p class="mt-1 text-sm text-base-content/80">
											{selectedSensor.description}
										</p>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>

				<!-- =============================================================
				     Card 2: Data Streams
				     ============================================================= -->
				<div class="card bg-base-300">
					<div class="card-body p-4">
						<div class="mb-4 flex items-center justify-between">
							<h3 class="font-mono text-xs tracking-wider text-base-content/40 uppercase">
								Data Streams
							</h3>
						</div>

						{#if streams.length === 0}
							<div class="flex flex-col items-center justify-center py-4 text-base-content/30">
								<svg
									class="mb-2 h-8 w-8 opacity-30"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M3 12h3l3-7 4 14 3-7h5" />
								</svg>
								<span class="font-mono text-xs">No data streams</span>
							</div>
						{:else}
							<div class="space-y-2">
								{#each streams as stream (stream.id)}
									<div class="flex items-center justify-between rounded-lg bg-base-200 p-3">
										<div class="flex min-w-0 items-center gap-3">
											<div
												class="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-primary/20 bg-primary/10"
											>
												<svg
													class="h-4 w-4 text-primary"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<path d="M3 12h3l3-7 4 14 3-7h5" />
												</svg>
											</div>
											<div class="min-w-0">
												<span class="block truncate font-mono text-sm font-medium"
													>{stream.name}</span
												>
												{#if stream.description}
													<span class="block truncate text-xs text-base-content/40">
														{stream.description}
													</span>
												{/if}
											</div>
										</div>
										{#if stream.unit_of_measurement}
											<span
												class="badge badge-ghost font-mono text-[10px] tracking-wider uppercase"
											>
												{stream.unit_of_measurement}
											</span>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- =============================================================
				     Card 3: Ownerships (read-only — assignment management
				     lives on the Participants page `/users`).
				     ============================================================= -->
				<div class="card bg-base-300">
					<div class="card-body p-4">
						<div class="mb-4 flex items-center justify-between">
							<h3 class="font-mono text-xs tracking-wider text-base-content/40 uppercase">
								Ownerships
							</h3>
							<span class="font-mono text-[10px] tracking-wider text-base-content/30 uppercase">
								{ownerships.length}
								{ownerships.length === 1 ? 'participant' : 'participants'}
							</span>
						</div>

						{#if ownerships.length === 0}
							<div class="flex flex-col items-center justify-center py-4 text-base-content/30">
								<svg
									class="mb-2 h-8 w-8 opacity-30"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
								>
									<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
									<circle cx="12" cy="7" r="4" />
								</svg>
								<span class="font-mono text-xs">No participants assigned</span>
							</div>
						{:else}
							<div class="space-y-2">
								{#each ownerships as ownership (ownership.user_id + '|' + ownership.sensor_id + '|' + ownership.start_date)}
									<div class="rounded-lg bg-base-200 p-3">
										<div class="flex items-center gap-3">
											<div
												class="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-primary/20 bg-primary/10"
											>
												<span class="font-display text-sm font-bold text-primary">
													{avatarInitial(ownership)}
												</span>
											</div>
											<div class="min-w-0 flex-1">
												<span class="block truncate font-mono text-sm font-medium">
													{ownership.participant_name ||
														(ownership.username ? '@' + ownership.username : null) ||
														`User ${ownership.user_id.slice(0, 8)}`}
												</span>
												{#if ownership.username}
													<span class="block truncate font-mono text-xs text-primary">
														@{ownership.username}
													</span>
												{/if}
												<div class="mt-0.5">
													<PeriodBadge start={ownership.start_date} end={ownership.end_date} />
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- =============================================================
				     Card 4: Recent Observations
				     ============================================================= -->
				<div class="card bg-base-300">
					<div class="card-body p-4">
						<h3 class="mb-4 font-mono text-xs tracking-wider text-base-content/40 uppercase">
							Recent Observations
						</h3>

						{#if recentObservations.length === 0}
							<div class="flex flex-col items-center justify-center py-4 text-base-content/30">
								<svg
									class="mb-2 h-8 w-8 opacity-30"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<circle cx="12" cy="12" r="10" />
									<polyline points="12 6 12 12 16 14" />
								</svg>
								<span class="font-mono text-xs">No recent observations</span>
							</div>
						{:else}
							<div class="space-y-1">
								<div
									class="grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr] gap-2 px-1 pb-1 font-mono text-[10px] tracking-wider text-base-content/30 uppercase"
								>
									<span>Time</span>
									<span>Stream</span>
									<span class="text-right">Result</span>
									<span class="text-right">Location</span>
								</div>
								{#each recentObservations as obs (obs.id)}
									<div
										class="grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr] items-center gap-2 rounded-md bg-base-200 px-2 py-1.5"
									>
										<span class="truncate font-mono text-xs text-base-content/70">
											{formatPhenomenonTime(obs.phenomenon_time)}
										</span>
										<span class="truncate font-mono text-xs" title={obs.data_stream_name}>
											{obs.data_stream_name}
										</span>
										<span class="truncate text-right font-mono text-xs font-medium text-primary">
											{Number(obs.result).toFixed(2)}
										</span>
										<span class="truncate text-right font-mono text-xs text-base-content/60">
											{obs.location ?? '—'}
										</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>
		{:else}
			<!-- Defensive fallback: parent mounted the panel but passed no sensor. -->
			<div class="flex h-full items-center justify-center">
				<div class="text-center text-base-content/30">
					<svg
						class="mx-auto mb-3 h-12 w-12 opacity-30"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<rect x="2" y="6" width="20" height="12" rx="2" />
						<path d="M6 12h.01M12 12h.01" />
					</svg>
					<p class="font-mono text-sm">No device selected</p>
				</div>
			</div>
		{/if}
	</aside>
{/if}
