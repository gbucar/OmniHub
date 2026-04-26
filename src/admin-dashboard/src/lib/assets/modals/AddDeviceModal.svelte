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
</script>

{#if show}
	<div class="modal-open modal">
		<div class="modal-box max-w-md bg-base-100">
			<div class="mb-6 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-base-content">Add Device to Participant</h3>
				<button class="btn btn-circle btn-ghost btn-sm" onclick={onClose}>✕</button>
			</div>

			<div class="space-y-4">
				<div class="form-control">
					<label class="label">
						<span class="label-text">Select Sensor</span>
					</label>
					<div class="relative max-w-full">
						<input
							class="input-bordered input input-sm w-full"
							type="text"
							placeholder="Search sensors..."
							bind:value={sensorSearch}
							onfocus={() => onToggleDropdown(true)}
							oninput={(e) => {
								onSensorSearchChange(e.currentTarget.value);
								onToggleDropdown(true);
							}}
							onblur={() => {
								// Delay closing to allow option selection
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
								class="absolute right-0 left-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-box border border-base-300 bg-base-100 shadow-lg"
								onmousedown={(e) => e.preventDefault()}
							>
								{#each filteredSensors as sensor, index}
									<li
										class="cursor-pointer p-3 hover:bg-base-200 {focusedSensorIndex === index
											? 'bg-base-200'
											: ''}"
										onclick={() => onSelectSensor(sensor)}
										onmouseenter={() => onFocusSensor(index)}
										onmouseleave={() => onFocusSensor(-1)}
									>
										<div class="font-medium">{sensor.name}</div>
										{#if sensor.description}
											<div class="text-sm text-base-content/70">{sensor.description}</div>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="form-control">
						<label class="label">
							<span class="label-text">Ownership Start Date</span>
						</label>
						<input
							class="input-bordered input input-sm"
							type="date"
							bind:value={newOwnership.start_date}
							required
						/>
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text">Ownership End Date</span>
						</label>
						<input
							class="input-bordered input input-sm"
							type="date"
							bind:value={newOwnership.end_date}
							required
						/>
					</div>
				</div>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={onClose}>Cancel</button>
				<button class="btn btn-primary" onclick={() => onAdd(newOwnership)}>Add Device</button>
			</div>
		</div>
	</div>
{/if}
