<script lang="ts">
	import type { Sensor } from '$lib/api';

	interface Props {
		show: boolean;
		newOwnership: {
			sensor_id: string;
			start_date: string;
			end_date: string;
		};
		sensorSearch: string;
		sensors: Sensor[];
		filteredSensors: Sensor[];
		showSensorDropdown: boolean;
		focusedSensorIndex: number;
		onAdd: (ownership: typeof newOwnership) => void;
		onClose: () => void;
		onSensorSearchChange: (value: string) => void;
		onSelectSensor: (sensor: Sensor) => void;
		onToggleDropdown: (show: boolean) => void;
		onFocusSensor: (index: number) => void;
	}

	let {
		show,
		newOwnership = $bindable(),
		sensorSearch = $bindable(''),
		sensors,
		filteredSensors,
		showSensorDropdown = $bindable(false),
		focusedSensorIndex = $bindable(-1),
		onAdd,
		onClose,
		onSensorSearchChange,
		onSelectSensor,
		onToggleDropdown,
		onFocusSensor
	}: Props = $props();

	let panelVisible = $state(false);

	let dateError = $derived(
		newOwnership.start_date &&
			newOwnership.end_date &&
			newOwnership.end_date < newOwnership.start_date
			? 'End date must be on or after start date'
			: ''
	);

	let isFormValid = $derived(
		newOwnership.sensor_id !== '' &&
			newOwnership.start_date !== '' &&
			newOwnership.end_date !== '' &&
			dateError === ''
	);

	$effect(() => {
		if (show) {
			// trigger next tick so the transition can animate from translate-y-4 to translate-y-0
			queueMicrotask(() => (panelVisible = true));
		} else {
			panelVisible = false;
		}
	});

	const handleClose = () => {
		panelVisible = false;
		onClose();
	};
</script>

{#if show}
	<!-- Backdrop -->
	<button
		class="fixed inset-0 z-40 cursor-default bg-black/50 backdrop-blur-sm transition-opacity duration-200 {panelVisible
			? 'opacity-100'
			: 'pointer-events-none opacity-0'}"
		aria-label="Close dialog"
		onclick={handleClose}
	></button>

	<!-- Panel -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="add-device-title"
	>
		<div
			class="modal-box w-full max-w-md bg-base-200 shadow-2xl transition-all duration-200 {panelVisible
				? 'translate-y-0 opacity-100'
				: 'translate-y-4 opacity-0'}"
		>
			<button
				class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm"
				aria-label="Close"
				onclick={handleClose}
			>
				<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>

			<div class="mb-6 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl border border-warning/20 bg-warning/10"
				>
					<svg
						class="h-5 w-5 text-warning"
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
					<h3 id="add-device-title" class="font-display text-lg font-semibold">Assign Device</h3>
					<p class="font-mono text-xs text-base-content/40">Link sensor to participant</p>
				</div>
			</div>

			<div class="space-y-4">
				<div class="form-control">
					<label class="label" for="sensor-search">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
							>Select Sensor</span
						>
					</label>
					<!-- The wrapper uses `relative` but is NOT clipped — the absolutely positioned
					     dropdown sits on top of subsequent content, not inside an overflow-hidden
					     parent. z-30 keeps it above the modal box contents (which stay at default
					     stacking), and the dropdown uses max-h-64 + overflow-y-auto so a long list
					     scrolls internally instead of being clipped. -->
					<div class="relative">
						<input
							id="sensor-search"
							class="input-bordered input w-full pr-10"
							type="text"
							placeholder="Search sensors..."
							autocomplete="off"
							bind:value={sensorSearch}
							onfocus={() => onToggleDropdown(true)}
							oninput={(e) => {
								onSensorSearchChange(e.currentTarget.value);
								onToggleDropdown(true);
							}}
							onblur={() => {
								setTimeout(() => {
									onToggleDropdown(false);
									onFocusSensor(-1);
								}, 150);
							}}
							onkeydown={(e) => {
								if (!showSensorDropdown || filteredSensors.length === 0) return;

								switch (e.key) {
									case 'ArrowDown':
										e.preventDefault();
										onFocusSensor(Math.min(focusedSensorIndex + 1, filteredSensors.length - 1));
										break;
									case 'ArrowUp':
										e.preventDefault();
										onFocusSensor(Math.max(focusedSensorIndex - 1, -1));
										break;
									case 'Enter':
										e.preventDefault();
										if (focusedSensorIndex >= 0 && focusedSensorIndex < filteredSensors.length) {
											onSelectSensor(filteredSensors[focusedSensorIndex]);
										}
										break;
									case 'Escape':
										e.preventDefault();
										onToggleDropdown(false);
										onFocusSensor(-1);
										break;
								}
							}}
							required
						/>
						{#if showSensorDropdown && filteredSensors.length > 0}
							<ul
								class="absolute top-full left-0 z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral/20 bg-base-300 shadow-2xl"
								role="listbox"
							>
								{#each filteredSensors as sensor, index (sensor.id)}
									<li
										class="cursor-pointer px-4 py-3 text-sm transition-colors hover:bg-primary/10 {focusedSensorIndex ===
										index
											? 'bg-primary/10 text-primary'
											: ''}"
										onmousedown={(e) => e.preventDefault()}
										onclick={() => onSelectSensor(sensor)}
										onmouseenter={() => onFocusSensor(index)}
										onmouseleave={() => onFocusSensor(-1)}
										role="option"
										aria-selected={focusedSensorIndex === index}
									>
										<div class="font-mono">{sensor.name}</div>
										{#if sensor.description}
											<div class="mt-0.5 text-xs text-base-content/40">{sensor.description}</div>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="form-control">
						<label class="label" for="ownership-start">
							<span
								class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
								>Start Date</span
							>
						</label>
						<input
							id="ownership-start"
							type="date"
							class="input-bordered input w-full"
							bind:value={newOwnership.start_date}
							required
						/>
					</div>
					<div class="form-control">
						<label class="label" for="ownership-end">
							<span
								class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
								>End Date</span
							>
						</label>
						<input
							id="ownership-end"
							type="date"
							class="input-bordered input w-full"
							bind:value={newOwnership.end_date}
							min={newOwnership.start_date || undefined}
							required
						/>
					</div>
				</div>
				{#if dateError}
					<div class="alert-sm alert alert-error">
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<circle cx="12" cy="12" r="10" />
							<path d="M12 8v4M12 16h.01" />
						</svg>
						<span class="text-xs">{dateError}</span>
					</div>
				{/if}
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={handleClose}>Cancel</button>
				<button class="btn btn-warning" onclick={() => onAdd(newOwnership)} disabled={!isFormValid}>
					<svg
						class="h-4 w-4"
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
		</div>
	</div>
{/if}
