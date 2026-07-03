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

	let dialogEl = $state<HTMLDialogElement | null>(null);

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
		if (show && dialogEl) {
			dialogEl.showModal();
		} else if (!show && dialogEl) {
			dialogEl.close();
		}
	});

	const handleClose = () => {
		dialogEl?.close();
		onClose();
	};
</script>

<dialog bind:this={dialogEl} class="modal" onclose={handleClose}>
	<div class="modal-box bg-base-200">
		<form method="dialog">
			<button class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm" aria-label="Close">
				<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</form>

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
				<h3 class="font-display text-lg font-semibold">Assign Device</h3>
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
				<div class="relative">
					<input
						id="sensor-search"
						class="input-bordered input w-full pr-10"
						type="text"
						placeholder="Search sensors..."
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
							class="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-neutral/20 bg-base-300 shadow-lg"
						>
							{#each filteredSensors as sensor, index}
								<li
									class="cursor-pointer px-4 py-3 text-sm hover:bg-primary/10 {focusedSensorIndex ===
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
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
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
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
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
			<form method="dialog">
				<button class="btn btn-ghost">Cancel</button>
			</form>
			<button class="btn btn-warning" onclick={() => onAdd(newOwnership)} disabled={!isFormValid}>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 5v14M5 12h14" />
				</svg>
				Assign
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
