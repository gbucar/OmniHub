<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		type Sensor,
		type DataStream,
		type SensorOwnership,
		type RecentObservation
	} from '$lib/api';
	import PeriodBadge from './PeriodBadge.svelte';
	import SensorStatusBadge from './SensorStatusBadge.svelte';

	/**
	 * Right-side slide-in sidebar showing details of a selected sensor.
	 *
	 * Read-only display panel. The parent owns the data and the API calls —
	 * this component is purely a presentation shell. It never mutates
	 * `selectedSensor` and never calls the API directly.
	 *
	 * The Ownerships card is read-only by design — device→participant
	 * assignment is managed from the Participants page (`/users`) so the
	 * Devices page stays a pure "browse & inspect device" surface.
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
	}>();

	// --- slide-in animation ---
	let panelVisible = $state(false);

	$effect(() => {
		if (show) {
			// Defer to the next task so the browser paints the initial
			// translate-x-full position first, then animates the slide-in.
			setTimeout(() => (panelVisible = true), 0);
		} else {
			panelVisible = false;
		}
	});

	// Slide in when the parent swaps the active sensor.
	$effect(() => {
		if (selectedSensor) {
			setTimeout(() => (panelVisible = true), 0);
		}
	});

	const closeDetailsPanel = () => {
		panelVisible = false;
		setTimeout(() => dispatch('close'), 200);
	};

	// --- formatters ---

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
				     Card 1: Information (read-only)
				     ============================================================= -->
				<div class="card bg-base-300">
					<div class="card-body p-4">
						<div class="mb-4">
							<h3 class="font-mono text-xs tracking-wider text-base-content/40 uppercase">
								Information
							</h3>
						</div>

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
									status={(selectedSensor.properties?.status as string) ?? 'unknown'}
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

							<!-- Metadata: all properties except the reserved `status` key -->
							{#if selectedSensor.properties}
								{#if Object.keys(selectedSensor.properties).some((k) => k !== 'status')}
									<div class="pt-2">
										<span
											class="font-mono text-xs tracking-wider text-base-content/30 uppercase"
										>
											Metadata
										</span>
										<div class="mt-1 space-y-1.5">
											{#each Object.entries(selectedSensor.properties).filter(([k]) => k !== 'status') as [key, value]}
												<div class="flex items-center justify-between">
													<span class="font-mono text-xs text-base-content/40">{key}</span>
													<span class="font-mono text-xs text-base-content/70"
														>{value as string}</span
													>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							{/if}
						</div>
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
