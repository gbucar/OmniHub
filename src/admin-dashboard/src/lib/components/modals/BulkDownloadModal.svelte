<script lang="ts">
	import {
		getParticipants,
		getParticipantStudies,
		getUserOwnerships,
		type Participant,
		type Study,
		type Ownership,
		type ParticipantStudy
	} from '$lib/api';
	import { serializeCSV, downloadCSV } from '$lib/utils/csv';
	import { parseRangeBounds } from '$lib/utils/bulk';
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
	let studyParticipantStudies = $state.raw<Record<string, ParticipantStudy[]>>({});
	let studyUserOwnerships = $state.raw<Record<string, Ownership[]>>({});

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
			studyParticipantStudies = {};
			studyUserOwnerships = {};
			return;
		}
		void loadParticipantsForStudy(studyId);
	});

	async function loadParticipantsForStudy(id: string) {
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
			participantsInStudy = result.data;
			// Pre-select any preselected users that belong to this study.
			if (preselectedUserIds.length > 0) {
				const valid = new Set(result.data.map((p) => p.user_id));
				selectedForDownload = new Set(preselectedUserIds.filter((uid) => valid.has(uid)));
			} else {
				selectedForDownload = new Set();
			}
			// Fetch per-user study dates and ownerships lazily — only when
			// the user clicks "Download". The modal stays responsive while
			// the user picks rows.
		} catch (error) {
			console.error('Failed to load participants for study:', error);
			showToast('Failed to load participants for study', 'error');
			participantsInStudy = [];
			selectedForDownload = new Set();
		} finally {
			isLoadingParticipants = false;
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

	const studyName = $derived(studies.find((s) => String(s.id) === studyId)?.name ?? 'unknown');

	async function handleDownload() {
		if (selectedForDownload.size === 0) {
			showToast('Select at least one participant', 'error');
			return;
		}
		const selected = participantsInStudy.filter((p) => selectedForDownload.has(p.user_id));
		if (selected.length === 0) return;

		// Fetch per-user study periods and device ownerships in parallel.
		// We do this just-in-time so the modal can stay snappy while the
		// user browses the participant list.
		const userIds = selected.map((p) => p.user_id);
		try {
			const [periods, ownerships] = await Promise.all([
				Promise.all(userIds.map((uid) => getParticipantStudies(uid))),
				Promise.all(userIds.map((uid) => getUserOwnerships(uid)))
			]);
			const periodsByUser: Record<string, ParticipantStudy[]> = {};
			userIds.forEach((uid, i) => {
				periodsByUser[uid] = periods[i];
			});
			const ownershipsByUser: Record<string, Ownership[]> = {};
			userIds.forEach((uid, i) => {
				ownershipsByUser[uid] = ownerships[i];
			});
			studyParticipantStudies = periodsByUser;
			studyUserOwnerships = ownershipsByUser;
		} catch (error) {
			console.error('Failed to fetch study periods / devices:', error);
			showToast('Failed to fetch study periods or device assignments', 'error');
			return;
		}

		// Compute the maximum number of devices any selected user has, capped
		// to keep the CSV sane. Devices are sorted by start_date so the
		// ordering is stable.
		const maxDevices = Math.max(
			0,
			...selected.map((p) => (studyUserOwnerships[p.user_id] ?? []).length)
		);

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

		const rows: string[][] = selected.map((p) => {
			const props = (p.properties ?? {}) as Record<string, unknown>;
			const nameVal = typeof props.name === 'string' ? props.name : '';
			const ageVal = props.age != null ? String(props.age) : '';
			const sexVal = typeof props.sex === 'string' ? props.sex : '';
			const typeVal = typeof props.type === 'string' ? props.type : '';
			const createdVal = p.sys_created_at ?? '';

			// Use the period of THIS study if the user is a member of it;
			// otherwise empty (multi-study users would otherwise be wrong).
			const studyPeriod = (studyParticipantStudies[p.user_id] ?? []).find(
				(s) => s.study_id === Number(studyId)
			);
			const periodBounds = parseRangeBounds(studyPeriod?.membership_period ?? null);

			const devices = (studyUserOwnerships[p.user_id] ?? []).slice();
			devices.sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
			const deviceCells: string[] = [];
			for (let i = 0; i < maxDevices; i++) {
				const d = devices[i];
				const sensor = d?.list_sensors;
				deviceCells.push(sensor?.name ?? '');
				deviceCells.push(d?.start_date?.slice(0, 10) ?? '');
				deviceCells.push(d?.end_date?.slice(0, 10) ?? '');
			}

			return [
				p.user_id,
				p.username ?? '',
				p.role ?? '',
				typeVal,
				nameVal,
				ageVal,
				sexVal,
				createdVal,
				studyName,
				periodBounds.start,
				periodBounds.end,
				...deviceCells
			];
		});

		const csv = serializeCSV(allHeaders, rows);
		const today = new Date().toISOString().slice(0, 10);
		const safeStudyName = studyName.replace(/[^a-zA-Z0-9_-]/g, '_');
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
