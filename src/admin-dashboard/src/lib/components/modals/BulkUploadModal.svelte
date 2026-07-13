<script lang="ts">
	import {
		getSensors,
		addParticipantAndReturnId,
		addParticipantToStudy,
		addOwnership,
		lookupUserIdByUsername,
		type Study,
		type Sensor
	} from '$lib/api';
	import { parseCSV } from '$lib/utils/csv';
	import {
		autoDetectMapping,
		parseRowFromMapping,
		validateAllRows,
		indexHeaders,
		attachHeaderIndex,
		MAX_DEVICES,
		NO_MAPPING,
		SYSTEM_FIELDS,
		type ParsedRow,
		type ValidationResult
	} from '$lib/utils/bulk';
	import { showToast } from '$lib/stores/toast';

	interface Props {
		show: boolean;
		studies: Study[];
		/** Called when the import finishes successfully — parent refetches. */
		onImported: () => void | Promise<void>;
		onClose: () => void;
	}

	let { show, studies, onImported, onClose }: Props = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	type Step = 1 | 2 | 3;
	let step = $state<Step>(1);

	// Step 1 state — raw CSV text + parsed result.
	let rawCsv = $state('');
	let loadedFileName = $state<string | null>(null);
	let parsedHeaders = $state.raw<string[]>([]);
	let parsedRows = $state.raw<Array<string[] & { __headerIndex?: Record<string, number> }>>([]);
	let loadError = $state('');

	// Step 2 state — column mapping.
	let mapping = $state<Record<string, string>>({});

	// Step 3 state — defaults + per-row overrides.
	let defaultStudyId = $state('');
	let defaultPassword = $state('changeme');
	let sensors = $state.raw<Sensor[]>([]);
	let sensorsLoaded = $state(false);
	let isImporting = $state(false);
	// Tracks the indices the user has removed from the preview. The keys
	// are the row indexes from the original `parsedRows` array; we keep
	// them as a Set so removal is O(1).
	let dismissedRowIndexes = $state(new Set<number>());

	$effect(() => {
		if (show && dialogEl) {
			dialogEl.showModal();
		} else if (!show && dialogEl) {
			dialogEl.close();
		}
	});

	// Reset state every time the modal opens.
	$effect(() => {
		if (show) {
			step = 1;
			rawCsv = '';
			loadedFileName = null;
			parsedHeaders = [];
			parsedRows = [];
			mapping = {};
			loadError = '';
			defaultStudyId = '';
			defaultPassword = 'changeme';
			dismissedRowIndexes = new Set();
			// Re-load sensors each time the modal opens so the catalog is
			// fresh — but only if it's empty (e.g. on first open). On
			// subsequent opens within the same session we keep the cache.
			if (!sensorsLoaded) {
				void loadSensors();
			}
		}
	});

	// Re-parse whenever `rawCsv` changes — covers both file uploads
	// (which set `rawCsv` from the file text) AND live typing in the
	// paste textarea. Without this effect the preview only refreshed
	// when the user clicked "Next".
	$effect(() => {
		void rawCsv;
		parseAndPreview();
	});

	async function loadSensors() {
		try {
			sensors = await getSensors();
			sensorsLoaded = true;
		} catch (error) {
			// Leave `sensorsLoaded = false` so the step-3 warning stays
			// visible — the admin should know the catalog may be stale
			// or incomplete.
			console.error('Failed to load sensors:', error);
			showToast('Failed to load sensors', 'error');
		}
	}

	const handleClose = () => {
		dialogEl?.close();
		onClose();
	};

	// ---- Step 1: Load -----------------------------------------------------

	async function onFileSelected(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const text = await file.text();
		rawCsv = text;
		loadedFileName = file.name;
		// Note: `parseAndPreview` is now invoked by the `$effect` that
		// watches `rawCsv` (declared above), so we don't call it here.
		// Reset the input so the same file can be re-picked.
		input.value = '';
	}

	function onPasteChange(value: string) {
		rawCsv = value;
	}

	function parseAndPreview() {
		loadError = '';
		const trimmed = rawCsv.trim();
		if (trimmed === '') {
			loadError = 'CSV is empty';
			return;
		}
		const result = parseCSV(trimmed);
		if (result.headers.length === 0) {
			loadError = 'CSV must have a header row';
			return;
		}
		if (result.rows.length === 0) {
			loadError = 'CSV has no data rows';
			return;
		}
		parsedHeaders = result.headers;
		try {
			const headerIndex = indexHeaders(result.headers);
			parsedRows = attachHeaderIndex(result.rows, headerIndex);
		} catch (err) {
			// `indexHeaders` throws on duplicate or empty headers —
			// surface that to the admin as a clear error message
			// instead of letting it crash the wizard.
			loadError = err instanceof Error ? err.message : 'Invalid CSV header row';
			parsedRows = [];
			return;
		}
		// Pre-populate mapping with auto-detected values so the user can
		// move to step 2 with one click if the CSV is well-formed.
		mapping = autoDetectMapping(result.headers);
	}

	const canGoToStep2 = $derived(parsedRows.length > 0 && parsedHeaders.length > 0);

	function nextToStep2() {
		parseAndPreview();
		if (canGoToStep2) {
			step = 2;
		}
	}

	// ---- Step 2: Map ------------------------------------------------------

	// System fields shown in the dropdown list — for device_N_* we generate
	// three fields per device (name, start_date, end_date).
	const deviceSystemFields = $derived(
		Array.from({ length: MAX_DEVICES }, (_, i) => {
			const n = i + 1;
			return [
				{ key: `device_${n}_name`, label: `Device ${n} name` },
				{ key: `device_${n}_start_date`, label: `Device ${n} start date` },
				{ key: `device_${n}_end_date`, label: `Device ${n} end date` }
			];
		}).flat()
	);

	function setMapping(key: string, value: string) {
		mapping = { ...mapping, [key]: value };
	}

	function runAutoDetect() {
		mapping = autoDetectMapping(parsedHeaders);
	}

	const usernameMapped = $derived(!!mapping.username && mapping.username !== NO_MAPPING);

	const canGoToStep3 = $derived(usernameMapped);

	function nextToStep3() {
		if (canGoToStep3) {
			step = 3;
		}
	}

	function backToStep1() {
		step = 1;
	}

	function backToStep2() {
		step = 2;
	}

	// ---- Step 3: Preview & Confirm ---------------------------------------

	const indexedRows = $derived(
		parsedRows.map((row, i) => {
			const parsed = parseRowFromMapping(row, mapping);
			return { index: i, parsed };
		})
	);

	const selectedStudy = $derived(
		defaultStudyId ? (studies.find((s) => String(s.id) === defaultStudyId) ?? null) : null
	);

	// Validation runs on the FULL set of parsed rows so that each result
	// carries a stable `index` pointing back into `parsedRows`. The
	// dismissed set is then applied to the rendered buckets — not to the
	// validator input. This keeps `dismissRow` working across re-renders.
	const allValidation = $derived(
		validateAllRows(
			indexedRows.map(({ parsed }) => parsed),
			sensors,
			studies,
			selectedStudy
		)
	);

	const notDismissed = (r: { index: number }) => !dismissedRowIndexes.has(r.index);
	const validation = $derived({
		valid: allValidation.valid.filter(notDismissed),
		problematic: allValidation.problematic.filter(notDismissed),
		rejected: allValidation.rejected.filter(notDismissed)
	});

	function dismissRow(originalIndex: number) {
		if (originalIndex < 0) return;
		const next = new Set(dismissedRowIndexes);
		next.add(originalIndex);
		dismissedRowIndexes = next;
	}

	async function executeImport() {
		if (validation.valid.length === 0) {
			showToast('No valid rows to import', 'error');
			return;
		}
		isImporting = true;
		let created = 0;
		let skipped = 0;
		let errors = 0;
		try {
			for (const v of validation.valid) {
				try {
					const row = v.row;
					// 1. Resolve study.
					const study = row.study_name
						? (studies.find((s) => s.name === row.study_name) ?? null)
						: selectedStudy;
					if (!study) {
						skipped++;
						continue;
					}
					// 2. Pre-check: does the user already exist? If so, skip
					// cleanly instead of creating an orphan when a later
					// step in the loop fails.
					const existingId = await lookupUserIdByUsername(row.username);
					if (existingId) {
						skipped++;
						continue;
					}
					// 3. Create user (with id lookup).
					const userId = await addParticipantAndReturnId({
						username: row.username,
						password: row.password || defaultPassword,
						properties: {
							name: row.name || null,
							age: row.age ? parseInt(row.age, 10) : null,
							sex: row.sex || null,
							type: row.type || null,
							// Carry the CSV-supplied (or today) creation date
							// into the participant's properties JSON so the
							// bulk download can round-trip it.
							sys_created_at: row.sys_created_at
						}
					});
					// 4. Attach to study.
					const period =
						row.study_start_date && row.study_end_date
							? `[${row.study_start_date} 00:00:00, ${row.study_end_date} 23:59:59.99999999)`
							: null;
					await addParticipantToStudy(userId, study.id, period);
					// 5. Attach device ownerships.
					for (const device of row.devices) {
						const sensor = sensors.find((s) => s.name === device.name);
						if (!sensor) continue; // safety; validate already filtered
						if (device.start && device.end) {
							await addOwnership({
								user_id: userId,
								sensor_id: sensor.id,
								start_date: device.start,
								end_date: device.end
							});
						}
					}
					created++;
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
						skipped++;
					} else {
						console.error('Row import failed:', err);
						errors++;
					}
				}
			}
			await onImported();
			const parts: string[] = [];
			if (created > 0) parts.push(`${created} created`);
			if (skipped > 0) parts.push(`${skipped} skipped`);
			if (errors > 0) parts.push(`${errors} errors`);
			const summary = parts.length > 0 ? parts.join(', ') : 'no rows processed';
			// Use success only when at least one row was actually created.
			// A pure-skip import (e.g. all rows were duplicates) is a
			// warning — nothing was imported.
			const tone = errors > 0 ? 'error' : created > 0 ? 'success' : 'error';
			showToast(`Import complete: ${summary}`, tone);
			handleClose();
		} finally {
			isImporting = false;
		}
	}

	const previewRows = $derived(parsedRows.slice(0, 3));
</script>

<dialog bind:this={dialogEl} class="modal" onclose={handleClose}>
	<div class="modal-box max-w-4xl bg-base-200">
		<form method="dialog">
			<button class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm" aria-label="Close">
				<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</form>

		<div class="mb-6 flex items-center gap-3">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/20 bg-accent/10"
			>
				<svg
					class="h-5 w-5 text-accent"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="17 8 12 3 7 8" />
					<line x1="12" y1="3" x2="12" y2="15" />
				</svg>
			</div>
			<div>
				<h3 class="font-display text-lg font-semibold">Bulk Upload</h3>
				<p class="font-mono text-xs text-base-content/40">Import participants from a CSV file</p>
			</div>
		</div>

		<!-- Steps indicator -->
		<ul class="steps mb-6 w-full">
			<li class="step {step >= 1 ? 'step-primary' : ''}">Load</li>
			<li class="step {step >= 2 ? 'step-primary' : ''}">Map</li>
			<li class="step {step >= 3 ? 'step-primary' : ''}">Preview &amp; Confirm</li>
		</ul>

		<!-- Step 1: Load -->
		{#if step === 1}
			<div class="space-y-4">
				<div class="form-control">
					<label class="label py-1" for="bulk-upload-file">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
							>Upload CSV</span
						>
					</label>
					<!--
						Native file inputs show browser-locale text alongside
						the "Choose File" button (e.g. "Datoteka ni izbrana" in
						Slovenian, "No file chosen" in English). That locale-
						specific placeholder is inconsistent with the rest
						of the UI and cannot be styled. We hide the native
						input and render an explicit "Choose file" button +
						"File not selected" / file name label so the wording
						is always english and matches the rest of the app.
					-->
					<input
						id="bulk-upload-file"
						type="file"
						accept=".csv,text/csv"
						class="hidden"
						onchange={onFileSelected}
					/>
					<div class="flex items-center gap-2">
						<button
							type="button"
							class="btn-bordered btn font-mono btn-sm"
							onclick={() => document.getElementById('bulk-upload-file')?.click()}
						>
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
							Choose file
						</button>
						<span
							class="font-mono text-sm {loadedFileName ? 'text-primary' : 'text-base-content/40'}"
						>
							{loadedFileName ?? 'File not selected'}
						</span>
					</div>
				</div>

				<div class="divider font-mono text-xs text-base-content/40">or</div>

				<div class="form-control">
					<div class="label py-1">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
							>Paste CSV</span
						>
					</div>
					<textarea
						id="bulk-upload-paste"
						class="textarea-bordered textarea min-h-32 font-mono text-xs"
						rows="8"
						placeholder={'username,name,age,study_name\njanez,Janez Novak,35,Study A'}
						value={rawCsv}
						oninput={(e) => onPasteChange((e.target as HTMLTextAreaElement).value)}
					></textarea>
				</div>

				{#if loadError}
					<div class="alert alert-error">
						<svg
							class="h-5 w-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="8" x2="12" y2="12" />
							<line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
						<span class="font-mono text-sm">{loadError}</span>
					</div>
				{/if}

				{#if parsedHeaders.length > 0}
					<div class="rounded-box border border-neutral/20 bg-base-100 p-3">
						<div class="mb-2 font-mono text-xs text-base-content/40 uppercase">
							Preview (first 3 rows)
						</div>
						<div class="overflow-x-auto">
							<table class="table table-sm">
								<thead>
									<tr>
										{#each parsedHeaders as h}
											<th class="font-mono text-xs">{h}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each previewRows as row}
										<tr>
											{#each parsedHeaders as _, i}
												<td class="font-mono text-xs">{row[i] ?? ''}</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Step 2: Map -->
		{#if step === 2}
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<p class="font-mono text-xs text-base-content/40">
						Map each CSV column to a system field. Required: <span
							class="font-semibold text-primary">username</span
						>.
					</p>
					<button type="button" class="btn btn-sm btn-primary" onclick={runAutoDetect}>
						Auto-detect
					</button>
				</div>
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
					{#each SYSTEM_FIELDS as field}
						<div class="form-control">
							<label class="label py-1" for="map-{field.key}">
								<span
									class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
								>
									{field.key}{field.required ? '*' : ''}
								</span>
							</label>
							<select
								id="map-{field.key}"
								class="select-bordered select w-full select-sm"
								value={mapping[field.key] ?? NO_MAPPING}
								onchange={(e) => setMapping(field.key, (e.target as HTMLSelectElement).value)}
							>
								<option value={NO_MAPPING}>(skip)</option>
								{#each parsedHeaders as h}
									<option value={h}>{h}</option>
								{/each}
							</select>
						</div>
					{/each}
					{#each deviceSystemFields as field}
						<div class="form-control">
							<label class="label py-1" for="map-{field.key}">
								<span
									class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
								>
									{field.label}
								</span>
							</label>
							<select
								id="map-{field.key}"
								class="select-bordered select w-full select-sm"
								value={mapping[field.key] ?? NO_MAPPING}
								onchange={(e) => setMapping(field.key, (e.target as HTMLSelectElement).value)}
							>
								<option value={NO_MAPPING}>(skip)</option>
								{#each parsedHeaders as h}
									<option value={h}>{h}</option>
								{/each}
							</select>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Step 3: Preview & Confirm -->
		{#if step === 3}
			<div class="space-y-4">
				{#if !sensorsLoaded}
					<div class="alert alert-warning">
						<span class="loading loading-xs loading-spinner"></span>
						<span class="font-mono text-sm"
							>Loading sensor catalog… device validation may be incomplete until ready.</span
						>
					</div>
				{/if}
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
					<div class="form-control">
						<label class="label" for="bulk-default-study">
							<span
								class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
								>Default study</span
							>
						</label>
						<select
							id="bulk-default-study"
							class="select-bordered select w-full"
							bind:value={defaultStudyId}
						>
							<option value="">(no default)</option>
							{#each studies as study}
								<option value={study.id.toString()}>{study.name}</option>
							{/each}
						</select>
						<p class="label">
							<span class="label-text-alt text-base-content/40">
								Used for rows with no <span class="font-mono">study_name</span> in the CSV.
							</span>
						</p>
					</div>
					<div class="form-control">
						<label class="label" for="bulk-default-password">
							<span
								class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
								>Default password</span
							>
						</label>
						<input
							id="bulk-default-password"
							type="text"
							class="input-bordered input w-full"
							placeholder="changeme"
							bind:value={defaultPassword}
						/>
						<p class="label">
							<span class="label-text-alt text-base-content/40">
								Used for rows with no <span class="font-mono">password</span> in the CSV.
							</span>
						</p>
					</div>
				</div>

				<!-- Valid -->
				<div class="rounded-box border border-success/30 bg-base-100 p-3">
					<div class="mb-2 flex items-center gap-2">
						<span class="badge font-mono badge-success">✓</span>
						<span class="font-mono text-sm"
							>Valid ({validation.valid.length}) — will be imported</span
						>
					</div>
					{#if validation.valid.length === 0}
						<p class="font-mono text-xs text-base-content/40">No valid rows.</p>
					{:else}
						<div class="max-h-40 overflow-y-auto">
							<table class="table table-xs">
								<thead>
									<tr>
										<th class="font-mono text-xs">username</th>
										<th class="font-mono text-xs">study</th>
										<th class="font-mono text-xs">actions</th>
									</tr>
								</thead>
								<tbody>
									{#each validation.valid as v, i (i)}
										<tr>
											<td class="font-mono text-xs">{v.row.username}</td>
											<td class="font-mono text-xs">
												{v.row.study_name || selectedStudy?.name || '—'}
											</td>
											<td class="font-mono text-xs text-base-content/60">
												{v.actions?.join(', ') || '—'}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>

				<!-- Problematic -->
				<div class="rounded-box border border-warning/30 bg-base-100 p-3">
					<div class="mb-2 flex items-center gap-2">
						<span class="badge font-mono badge-warning">!</span>
						<span class="font-mono text-sm"
							>Problematic ({validation.problematic.length}) — will not be imported</span
						>
					</div>
					{#if validation.problematic.length === 0}
						<p class="font-mono text-xs text-base-content/40">None.</p>
					{:else}
						<div class="max-h-40 overflow-y-auto">
							<table class="table table-xs">
								<thead>
									<tr>
										<th class="font-mono text-xs">username</th>
										<th class="font-mono text-xs">reason</th>
										<th class="font-mono text-xs"></th>
									</tr>
								</thead>
								<tbody>
									{#each validation.problematic as v, i (i)}
										<tr>
											<td class="font-mono text-xs">{v.row.username || '—'}</td>
											<td class="font-mono text-xs text-warning/80">{v.reason ?? '—'}</td>
											<td class="text-right">
												<button
													type="button"
													class="btn btn-ghost btn-xs"
													aria-label="Remove row"
													onclick={() => dismissRow(v.index)}
												>
													✕
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>

				<!-- Rejected -->
				<div class="rounded-box border border-error/30 bg-base-100 p-3">
					<div class="mb-2 flex items-center gap-2">
						<span class="badge font-mono badge-error">✗</span>
						<span class="font-mono text-sm"
							>Rejected ({validation.rejected.length}) — will not be imported</span
						>
					</div>
					{#if validation.rejected.length === 0}
						<p class="font-mono text-xs text-base-content/40">None.</p>
					{:else}
						<div class="max-h-40 overflow-y-auto">
							<table class="table table-xs">
								<thead>
									<tr>
										<th class="font-mono text-xs">username</th>
										<th class="font-mono text-xs">reason</th>
										<th class="font-mono text-xs"></th>
									</tr>
								</thead>
								<tbody>
									{#each validation.rejected as v, i (i)}
										<tr>
											<td class="font-mono text-xs">{v.row.username || '—'}</td>
											<td class="font-mono text-xs text-error/80">{v.reason ?? '—'}</td>
											<td class="text-right">
												<button
													type="button"
													class="btn btn-ghost btn-xs"
													aria-label="Remove row"
													onclick={() => dismissRow(v.index)}
												>
													✕
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Footer / nav -->
		<div class="modal-action">
			{#if step === 1}
				<form method="dialog">
					<button class="btn btn-ghost">Cancel</button>
				</form>
				<button class="btn btn-primary" onclick={nextToStep2} disabled={!canGoToStep2}>
					Next
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
			{:else if step === 2}
				<button class="btn btn-ghost" onclick={backToStep1}>Back</button>
				<button class="btn btn-primary" onclick={nextToStep3} disabled={!canGoToStep3}>
					Next
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
			{:else}
				<button class="btn btn-ghost" onclick={backToStep2} disabled={isImporting}>Back</button>
				<button
					class="btn btn-accent"
					onclick={executeImport}
					disabled={isImporting || validation.valid.length === 0}
				>
					{#if isImporting}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					Confirm & Import ({validation.valid.length} user{validation.valid.length === 1
						? ''
						: 's'})
				</button>
			{/if}
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
