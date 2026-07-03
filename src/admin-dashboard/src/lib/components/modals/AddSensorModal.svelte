<script lang="ts">
	import DeviceMetadataEditor from '$lib/components/DeviceMetadataEditor.svelte';
	import type { NewSensor } from '$lib/api';

	/**
	 * Add a new sensor to `data.sensors`. The new row is created with a
	 * sensible default `properties` object (always includes `status: 'active'`
	 * so the new device shows up green in the list immediately).
	 *
	 * The parent supplies the initial form state via `bind:newSensor` and
	 * gets the final object back via `onAdd`. We do not call the API here
	 * directly — that lives in the page so toast / reload can be handled
	 * uniformly across the app.
	 */
	interface Props {
		show: boolean;
		newSensor: NewSensor;
		onAdd: (sensor: NewSensor) => void;
		onClose: () => void;
	}

	let { show, newSensor = $bindable(), onAdd, onClose }: Props = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	// Suggested sensor types — these are the values seen in production
	// `99_populate.sql` and the most common IOT sensor models. Users can
	// still type a custom value via the "Other..." free-input combo.
	const SUGGESTED_TYPES = ['ATMOTUBE_PRO', 'ATMOAIR_PRO', 'ATMODOT_PRO', 'ATMOAIR_V2'];

	let customType = $state('');
	let showCustomTypeInput = $derived(
		newSensor.sensor_type !== '' && !SUGGESTED_TYPES.includes(newSensor.sensor_type)
	);

	// local working copy of metadata; sync with the bound prop on open/close.
	let metadataDraft = $state<Record<string, unknown>>({});

	$effect(() => {
		if (show) {
			metadataDraft = { ...(newSensor.properties ?? {}) };
		}
	});

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

	// Strip empty-string credential_id so we send undefined to the API
	// (which already maps undefined -> null in sensors.ts).
	const normalisedSensor = $derived({
		...newSensor,
		credential_id:
			newSensor.credential_id === undefined || newSensor.credential_id === ('' as unknown)
				? undefined
				: newSensor.credential_id,
		// Merge metadata editor draft (which excludes the reserved `status`
		// key) back into the persisted properties.
		properties: { ...metadataDraft, status: newSensor.properties?.status ?? 'active' }
	});

	const isFormValid = $derived(
		newSensor.name.trim() !== '' &&
			newSensor.sensor_type.trim() !== '' &&
			(newSensor.credential_id === undefined ||
				newSensor.credential_id === ('' as unknown) ||
				(Number.isInteger(Number(newSensor.credential_id)) && Number(newSensor.credential_id) >= 0))
	);

	const handleSubmit = () => {
		if (!isFormValid) return;
		onAdd(normalisedSensor);
	};

	const onTypeSelect = (value: string) => {
		if (value === '__custom__') {
			customType = '';
			newSensor = { ...newSensor, sensor_type: '' };
		} else {
			newSensor = { ...newSensor, sensor_type: value };
		}
	};

	$effect(() => {
		// Keep sensor_type in sync with the free-input field when in custom mode.
		if (showCustomTypeInput) {
			newSensor = { ...newSensor, sensor_type: customType };
		}
	});
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
				<h3 class="font-display text-lg font-semibold">Add Device</h3>
				<p class="font-mono text-xs text-base-content/40">Register a new sensor</p>
			</div>
		</div>

		<div class="space-y-4">
			<div class="form-control">
				<label class="label" for="sensor-name">
					<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
						>Name</span
					>
				</label>
				<input
					id="sensor-name"
					class="input-bordered input w-full"
					placeholder="e.g. Living room Atmotube"
					bind:value={newSensor.name}
					required
				/>
			</div>

			<div class="form-control">
				<label class="label" for="sensor-type">
					<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
						>Sensor Type</span
					>
				</label>
				<select
					id="sensor-type"
					class="select-bordered select w-full"
					value={showCustomTypeInput ? '__custom__' : newSensor.sensor_type}
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
						class="input-bordered input mt-2 w-full font-mono"
						placeholder="Custom type identifier"
						bind:value={customType}
					/>
				{/if}
			</div>

			<div class="form-control">
				<label class="label" for="sensor-description">
					<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
						>Description</span
					>
				</label>
				<textarea
					id="sensor-description"
					class="textarea-bordered textarea w-full"
					placeholder="Optional notes about this sensor"
					rows="2"
					bind:value={newSensor.description}
				></textarea>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="form-control">
					<label class="label" for="sensor-status">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
							>Status</span
						>
					</label>
					<select
						id="sensor-status"
						class="select-bordered select w-full"
						value={newSensor.properties?.status ?? 'active'}
						onchange={(e) => {
							const status = (e.currentTarget as HTMLSelectElement).value;
							newSensor = {
								...newSensor,
								properties: { ...(newSensor.properties ?? {}), status }
							};
						}}
					>
						<option value="active">Active</option>
						<option value="inactive">Inactive</option>
						<option value="maintenance">Maintenance</option>
					</select>
				</div>

				<div class="form-control">
					<label class="label" for="sensor-credential">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
							>Credential ID</span
						>
					</label>
					<input
						id="sensor-credential"
						type="number"
						min="0"
						step="1"
						class="input-bordered input w-full font-mono"
						placeholder="Optional"
						bind:value={newSensor.credential_id}
					/>
				</div>
			</div>

			<div class="form-control">
				<label class="label">
					<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
						>Metadata</span
					>
				</label>
				<DeviceMetadataEditor bind:metadata={metadataDraft} />
			</div>
		</div>

		<div class="modal-action">
			<form method="dialog">
				<button class="btn btn-ghost">Cancel</button>
			</form>
			<button class="btn btn-primary" onclick={handleSubmit} disabled={!isFormValid}>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 5v14M5 12h14" />
				</svg>
				Add Device
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
