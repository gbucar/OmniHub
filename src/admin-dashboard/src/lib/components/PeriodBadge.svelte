<script lang="ts">
	import { getPeriodStatus, formatPeriodDisplay, type PeriodStatus } from '$lib/utils/period';

	interface Props {
		/**
		 * The period to display. Can be:
		 *  - a tstzrange string (e.g. study membership_period)
		 *  - undefined/null when used with separate start/end
		 */
		period?: string | null;
		/** Start date (used when `period` is not provided) */
		start?: string | Date | null;
		/** End date (used when `period` is not provided) */
		end?: string | Date | null;
		/**
		 * Whether to render the dates below the badge.
		 * `compact` (default): badge with dates inside, one line
		 * `stacked`: badge on its own line, dates below
		 */
		variant?: 'compact' | 'stacked';
		/** Override the status (otherwise it is computed) */
		status?: PeriodStatus;
	}

	let { period, start, end, variant = 'compact', status: statusOverride }: Props = $props();

	const computedStatus = $derived(getPeriodStatus(period ?? start, period ? undefined : end));
	const status = $derived<PeriodStatus>(statusOverride ?? computedStatus);
	const dates = $derived(formatPeriodDisplay(period ?? start, period ? undefined : end));

	const STATUS_CONFIG: Record<
		PeriodStatus,
		{ label: string; badgeClass: string; dotClass: string }
	> = {
		active: {
			label: 'Active',
			badgeClass: 'badge-success badge-soft',
			dotClass: 'bg-success'
		},
		upcoming: {
			label: 'Upcoming',
			badgeClass: 'badge-info badge-soft',
			dotClass: 'bg-info'
		},
		inactive: {
			label: 'Inactive',
			badgeClass: 'badge-neutral badge-soft',
			dotClass: 'bg-base-content/40'
		},
		none: {
			label: 'No period',
			badgeClass: 'badge-ghost',
			dotClass: 'bg-base-content/30'
		}
	};

	const config = $derived(STATUS_CONFIG[status]);
</script>

<div
	class="inline-flex {variant === 'stacked' ? 'flex-col items-start gap-1' : 'items-center gap-2'}"
>
	<span class="badge {config.badgeClass} gap-1.5 font-mono text-[10px] tracking-wider uppercase">
		<span class="inline-block h-1.5 w-1.5 rounded-full {config.dotClass}"></span>
		{config.label}
	</span>

	{#if dates}
		<span class="font-mono text-xs text-base-content/40">
			{dates.start} <span class="text-base-content/20">→</span>
			{dates.end}
		</span>
	{/if}
</div>
