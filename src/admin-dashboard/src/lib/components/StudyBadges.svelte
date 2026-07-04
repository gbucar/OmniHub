<script lang="ts">
	/**
	 * StudyBadges renders a list of study names as primary badges. The visible
	 * count adapts to the container width: at least one badge is always shown
	 * and any studies that do not fit are collapsed into a `+N` overflow chip
	 * that reveals them on hover.
	 *
	 * Width measurement works in two passes:
	 *   1. A hidden measurement row renders every badge with the same classes
	 *      that the visible row uses. Each badge's `offsetWidth` is read to
	 *      learn its true on-screen size (text length + padding vary, so a
	 *      hard-coded estimate would be wrong).
	 *   2. The visible row then picks the longest prefix of badges that fits
	 *      inside the available width, leaving room for a `+N` chip when there
	 *      is overflow.
	 *
	 * A `ResizeObserver` triggers a re-measure whenever the table column or
	 * viewport changes width.
	 */

	interface StudyRef {
		id: number;
		name: string;
	}

	interface Props {
		studies: StudyRef[];
		/** Smallest number of badges to keep visible, even if they overflow. */
		minVisible?: number;
	}

	let { studies, minVisible = 1 }: Props = $props();

	let containerEl = $state<HTMLDivElement | null>(null);
	let measureHostEl = $state<HTMLDivElement | null>(null);
	let badgeRefs = $state<HTMLSpanElement[]>([]);
	let visibleCount = $state<number>(0);
	let isReady = $state(false);

	// Pixel gap between adjacent badges. Matches the `gap-1` utility (4px) on
	// the visible row. We use it for both the visible and measurement rows so
	// the totals line up exactly.
	const GAP_PX = 4;

	function measureBadgeWidths(): number[] {
		if (!measureHostEl) return [];
		// badgeRefs is in render order; the measurement row renders the same
		// studies in the same order, so the indices line up.
		return badgeRefs.map((el) => el?.getBoundingClientRect().width ?? 0);
	}

	function recompute() {
		if (!containerEl) return;

		if (studies.length <= 1) {
			visibleCount = studies.length;
			isReady = true;
			return;
		}

		const available = containerEl.clientWidth;
		if (available <= 0) {
			// Layout not yet settled — keep the placeholder state, try again
			// on the next ResizeObserver tick.
			return;
		}

		const widths = measureBadgeWidths();
		if (widths.length !== studies.length) return;

		// Width of a `+N` chip with the same classes as the study badges.
		// We rebuild the string in the visible row, but estimate here using
		// the longest single badge (good enough for both tight and loose fits).
		const overflowChipWidth = Math.max(...widths) + 8;

		// First, try to fit all badges.
		const totalAll = widths.reduce((sum, w, i) => sum + w + (i > 0 ? GAP_PX : 0), 0);
		if (totalAll <= available) {
			visibleCount = studies.length;
			isReady = true;
			return;
		}

		// Not all fit. Find the largest k (>= minVisible) such that
		//   widths[0..k] + (overflowChipWidth if there's overflow) <= available.
		const remaining = studies.length;
		const overflowCount = (k: number) => remaining - k;
		const widthOfFirst = (k: number) => {
			let s = 0;
			for (let i = 0; i < k; i++) s += widths[i] + (i > 0 ? GAP_PX : 0);
			return s;
		};

		// Start from the maximum we could possibly show and walk down.
		let k = studies.length;
		const minK = Math.max(1, minVisible);
		while (k > minK) {
			const needOverflowChip = overflowCount(k) > 0;
			const chipW = needOverflowChip ? overflowChipWidth + GAP_PX : 0;
			if (widthOfFirst(k) + chipW <= available) break;
			k--;
		}

		// Last-ditch: even the minimum doesn't fit. Force-show minVisible anyway;
		// the cell will let the badges overflow rather than hiding everything.
		visibleCount = k;
		isReady = true;
	}

	$effect(() => {
		if (!containerEl) return;

		const ro = new ResizeObserver(() => recompute());
		ro.observe(containerEl);

		// Initial measure after layout settles.
		queueMicrotask(recompute);

		return () => ro.disconnect();
	});

	// Re-measure whenever the study list itself changes.
	$effect(() => {
		// Touch the dep so Svelte tracks it.
		studies.length;
		visibleCount = 0;
		isReady = false;
		queueMicrotask(recompute);
	});

	const visibleStudies = $derived(studies.slice(0, visibleCount));
	const overflowStudies = $derived(studies.slice(visibleCount));
</script>

<!-- The outer wrapper is `position: relative` so the absolutely positioned
     measurement host below is constrained to this cell's width, not the
     viewport. The visible row sits inside this same wrapper. -->
<div class="relative min-w-0">
	<div
		bind:this={containerEl}
		class="flex max-w-full flex-wrap items-center gap-1"
		role="list"
		aria-label="Studies"
	>
		{#if !isReady}
			<!-- Reserve at least one line of height so the row doesn't jump when
			     measurement completes. -->
			<span class="invisible badge badge-soft badge-primary">
				{studies[0]?.name ?? '—'}
			</span>
		{:else}
			{#each visibleStudies as study (study.id)}
				<span role="listitem" class="badge badge-soft font-mono badge-primary" title={study.name}>
					{study.name}
				</span>
			{/each}
			{#if overflowStudies.length > 0}
				<div class="dropdown-hover dropdown dropdown-end">
					<!-- `tabindex` so the dropdown can be triggered by keyboard focus
					     as well as hover. -->
					<span
						tabindex="0"
						role="button"
						class="badge cursor-default badge-ghost badge-soft font-mono"
						aria-label="Show {overflowStudies.length} more studies"
					>
						+{overflowStudies.length}
					</span>
					<ul
						class="dropdown-content menu z-20 mt-1 w-56 rounded-box border border-neutral/20 bg-base-300 p-2 shadow-lg"
					>
						<li class="menu-title px-2 py-1">
							<span class="font-mono text-xs tracking-wider text-base-content/40 uppercase"
								>More studies</span
							>
						</li>
						{#each overflowStudies as study (study.id)}
							<li>
								<span class="font-mono text-sm" title={study.name}>
									<span class="truncate">{study.name}</span>
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}
	</div>

	<!--
	  Hidden measurement row. Positioned absolutely so it never affects layout
	  but is still laid out (so `getBoundingClientRect().width` is accurate).
	  `aria-hidden` and `invisible` (visually-hidden but layout-visible) keep
	  it out of the accessibility tree and the screen.
	-->
	<div
		bind:this={measureHostEl}
		aria-hidden="true"
		class="pointer-events-none invisible absolute top-0 left-0 z-[-1] flex flex-nowrap items-center gap-1"
	>
		{#each studies as study, i (study.id)}
			<span
				bind:this={badgeRefs[i]}
				class="badge badge-soft font-mono whitespace-nowrap badge-primary"
			>
				{study.name}
			</span>
		{/each}
	</div>
</div>
