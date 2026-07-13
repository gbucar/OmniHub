<script lang="ts">
	import {
		pgClient,
		getParticipants,
		type Participant,
		type Study
	} from '$lib/api';
	import { serializeCSV, downloadCSV } from '$lib/utils/csv';
	import { showToast } from '$lib/stores/toast';

	interface Props {
		show: boolean;
		studies: Study[];
		/**
		 * Pre-selected user_ids passed in from the /users page when the
		 * modal is opened from the selection-aware dropdown. When non-empty,
		 * the participant list is preselected and the user cannot change
		 * the study (it is derived from the first selected user).
		 */
		preselectedUserIds?: string[];
		/**
		 * Optional pre-selected study id. When set, we skip the study
		 * dropdown and go straight to the participant list.
		 */
		preselectedStudyId?: number;
		onClose: () => void;
	}

	let { show, studies, preselectedUserIds = [], preselectedStudyId, onClose }: Props = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let studyId = $state('');
	let participantsInStudy = $state.raw<Participant[]>([]);
	let selectedForDownload = $state(new Set<string>());
	let isLoadingParticipants = $state(false);

	$effect(() => {
		if (show && dialogEl) {
			// Guard: `showModal()` on an already-open dialog throws
			// `InvalidStateError`. Cheap to check and avoids the red error
			// in the console when the parent re-renders while the dialog
			// is open.
			if (!dialogEl.open) dialogEl.showModal();
		} else if (!show && dialogEl) {
			dialogEl.close();
		}
	});

	const handleClose = () => {
		dialogEl?.close();
		onClose();
	};

	// When opened with a pre-selected study, set the dropdown to it and
	// trigger the participant fetch (driven by an effect on `studyId`).
	$effect(() => {
		if (show && preselectedStudyId != null) {
			studyId = String(preselectedStudyId);
		}
	});

	// When the study changes, fetch all its participants.
	$effect(() => {
		if (!show || !studyId) {
			participantsInStudy = [];
			selectedForDownload = new Set();
			return;
		}
		void loadParticipantsForStudy(studyId);
	});

	// Monotonic request id — every call to `loadParticipantsForStudy`
	// bumps it, and stale responses (older than the current id) are
	// discarded before they can overwrite fresher state. Avoids the
	// race where the user switches studies quickly and the first
	// response resolves last, clobbering the second.
	let studyRequestSeq = 0;

	async function loadParticipantsForStudy(id: string) {
		const reqId = ++studyRequestSeq;
		isLoadingParticipants = true;
		try {
			// `getParticipants` paginates and dedupes per-user. We pass a
			// large limit to get the full set; `many_participants_studies`
			// is LEFT JOINed so users with no study would still appear, but
			// we filter on the chosen study.
			const result = await getParticipants({
				study: id,
				limit: 1000,
				offset: 0
			});
			// Drop stale responses.
			if (reqId !== studyRequestSeq) return;
			participantsInStudy = result.data;
			// Pre-select any preselected users that belong to this study.
			if (preselectedUserIds.length > 0) {
				const valid = new Set(result.data.map((p) => p.user_id));
				selectedForDownload = new Set(preselectedUserIds.filter((uid) => valid.has(uid)));
			} else {
				selectedForDownload = new Set();
			}
		} catch (error) {
			// Don't overwrite newer data with an error from an older request.
			if (reqId !== studyRequestSeq) return;
			console.error('Failed to load participants for study:', error);
			showToast('Failed to load participants for study', 'error');
			participantsInStudy = [];
			selectedForDownload = new Set();
		} finally {
			if (reqId === studyRequestSeq) isLoadingParticipants = false;
		}
	}

	function toggleParticipant(userId: string) {
		const next = new Set(selectedForDownload);
		if (next.has(userId)) next.delete(userId);
		else next.add(userId);
		selectedForDownload = next;
	}

	function selectAllVisible() {
		selectedForDownload = new Set(participantsInStudy.map((p) => p.user_id));
	}

	function clearSelection() {
		selectedForDownload = new Set();
	}

	const allVisibleSelected = $derived(
		participantsInStudy.length > 0 &&
			participantsInStudy.every((p) => selectedForDownload.has(p.user_id))
	);

	async function handleDownload() {
		if (selectedForDownload.size === 0) {
			showToast('Select at least one participant', 'error');
			return;
		}
		const selected = participantsInStudy.filter((p) => selectedForDownload.has(p.user_id));
		if (selected.length === 0) return;

		const userIds = selected.map((p) => p.user_id);
		const studyIdNum = Number(studyId);

		let data: {
			study_name: string;
			max_devices: number;
			rows: Array<{
				user_id: string;
				username: string;
				role: string;
				type: string | null;
				name: string | null;
				age: string | null;
				sex: string | null;
				sys_created_at: string | null;
				study_name: string;
				study_start_date: string | null;
				study_end_date: string | null;
				devices: Array<{ name: string; start: string; end: string }>;
			}>;
		};

		try {
			const result = await pgClient
				?.schema('api')
				.rpc('bulk_download_participants', { study_id: studyIdNum, user_ids: userIds });

			if (result?.error) throw new Error(result.error.message);
			if (!result?.data) throw new Error('No data returned');

			data = result.data as typeof data;
		} catch (error) {
			console.error('Failed to fetch download data:', error);
			showToast('Failed to fetch participant data', 'error');
			return;
		}

		const maxDevices = data.max_devices;
		const deviceHeaders: string[] = [];
		for (let i = 0; i < maxDevices; i++) {
			const n = i + 1;
			deviceHeaders.push(`device_${n}_name`, `device_${n}_start_date`, `device_${n}_end_date`);
		}

		const baseHeaders = [
			'user_id',
			'username',
			'role',
			'type',
			'name',
			'age',
			'sex',
			'sys_created_at',
			'study_name',
			'study_start_date',
			'study_end_date'
		];
		const allHeaders = [...baseHeaders, ...deviceHeaders];

		const toDate = (val: string | null | undefined): string =>
			val ? val.slice(0, 10) : '';

		const rows: string[][] = data.rows.map((r) => {
			const deviceCells: string[] = [];
			for (let i = 0; i < maxDevices; i++) {
				const d = r.devices[i];
				deviceCells.push(d?.name ?? '');
				deviceCells.push(toDate(d?.start));
				deviceCells.push(toDate(d?.end));
			}
			return [
				r.user_id,
				r.username ?? '',
				r.role ?? '',
				r.type ?? '',
				r.name ?? '',
				r.age ?? '',
				r.sex ?? '',
				toDate(r.sys_created_at),
				data.study_name,
				toDate(r.study_start_date),
				toDate(r.study_end_date),
				...deviceCells
			];
		});

		const csv = serializeCSV(allHeaders, rows);
		const today = new Date().toISOString().slice(0, 10);
		const safeStudyName = data.study_name.replace(/[\/\\<>:"|?*\x00-\x1f]/g, '').replace(/\s+/g, '_');
		downloadCSV(`participants-study-${safeStudyName}-${today}.csv`, csv);
		showToast(`Downloaded ${selected.length} participants`, 'success');
		handleClose();
	}

	const showStudyPicker = $derived(preselectedStudyId == null);
</script>

<dialog bind:this={dialogEl} class="modal" onclose={handleClose}>
	<div class="modal-box max-w-3xl bg-base-200">
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
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="7 10 12 15 17 10" />
					<line x1="12" y1="15" x2="12" y2="3" />
				</svg>
			</div>
			<div>
				<h3 class="font-display text-lg font-semibold">Bulk Download</h3>
				<p class="font-mono text-xs text-base-content/40">
					Export participants from a study to CSV
				</p>
			</div>
		</div>

		<div class="space-y-5">
			{#if showStudyPicker}
				<div class="form-control">
					<label class="label" for="bulk-download-study">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
							>Study</span
						>
					</label>
					<select
						id="bulk-download-study"
						class="select-bordered select w-full"
						bind:value={studyId}
					>
						<option value="" disabled>Choose a study</option>
						{#each studies as study}
							<option value={study.id.toString()}>{study.name}</option>
						{/each}
					</select>
					<p class="label">
						<span class="label-text-alt text-base-content/40">
							Pick the study to export participants from.
						</span>
					</p>
				</div>
			{:else}
				<div class="alert bg-primary/10 alert-info">
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
					<span class="font-mono text-sm">
						Exporting {preselectedUserIds.length} selected participant{preselectedUserIds.length ===
						1
							? ''
							: 's'}.
					</span>
				</div>
			{/if}

			{#if studyId}
				<div class="form-control">
					<div class="mb-2 flex items-center justify-between">
						<span class="label-text font-mono text-xs tracking-wider text-base-content/40 uppercase"
							>Participants in study</span
						>
						<div class="flex gap-2">
							<button
								type="button"
								class="btn btn-ghost btn-xs"
								onclick={selectAllVisible}
								disabled={allVisibleSelected || participantsInStudy.length === 0}
							>
								Select all ({participantsInStudy.length})
							</button>
							<button
								type="button"
								class="btn btn-ghost btn-xs"
								onclick={clearSelection}
								disabled={selectedForDownload.size === 0}
							>
								Clear
							</button>
						</div>
					</div>

					<div class="max-h-96 overflow-y-auto rounded-box border border-neutral/20 bg-base-100">
						{#if isLoadingParticipants}
							<div class="flex items-center justify-center gap-2 p-6 text-base-content/50">
								<span class="loading loading-sm loading-spinner"></span>
								<span class="font-mono text-sm">Loading participants...</span>
							</div>
						{:else if participantsInStudy.length === 0}
							<div class="p-6 text-center font-mono text-sm text-base-content/40">
								No participants found in this study.
							</div>
						{:else}
							<ul class="divide-y divide-neutral/10">
								{#each participantsInStudy as participant (participant.user_id)}
									<li>
										<label
											class="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-primary/5"
										>
											<input
												type="checkbox"
												class="checkbox checkbox-sm"
												checked={selectedForDownload.has(participant.user_id)}
												onchange={() => toggleParticipant(participant.user_id)}
											/>
											<div
												class="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 font-mono text-xs text-primary"
											>
												{(participant.username?.[0] ?? 'U').toUpperCase()}
											</div>
											<div class="min-w-0 flex-1">
												<div class="truncate font-mono text-sm">
													{participant.username ?? '—'}
												</div>
												<div class="truncate text-xs text-base-content/40">
													{((participant.properties as Record<string, unknown> | null)?.name as
														| string
														| undefined) ?? '—'}
												</div>
											</div>
											{#if participant.type}
												<span class="badge badge-ghost font-mono badge-sm">
													{participant.type}
												</span>
											{/if}
										</label>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<div class="modal-action">
			<form method="dialog">
				<button class="btn btn-ghost">Cancel</button>
			</form>
			<button
				class="btn btn-primary"
				onclick={handleDownload}
				disabled={!studyId || selectedForDownload.size === 0}
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="7 10 12 15 17 10" />
					<line x1="12" y1="15" x2="12" y2="3" />
				</svg>
				Download CSV ({selectedForDownload.size})
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
