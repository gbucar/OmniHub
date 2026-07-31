<script lang="ts">
	interface Props {
		/**
		 * The sensor's `properties->>'status'` value. May be null/undefined
		 * if the field is absent — in that case we render the "unknown" badge.
		 */
		status: string | null | undefined;
	}

	let { status }: Props = $props();

	const normalized = $derived((status ?? '').toString().trim().toLowerCase());

	// Status -> daisyUI badge variant. Mirrors the visual language used
	// elsewhere in the dashboard: green for healthy, amber for maintenance,
	// neutral for inactive, ghost for unknown.
	const CONFIG: Record<string, { label: string; cls: string }> = {
		active: { label: 'Active', cls: 'badge-success badge-soft outline outline-1 -outline-offset-1 outline-success/30' },
		inactive: { label: 'Inactive', cls: 'badge-neutral badge-soft !bg-transparent !text-base-content/60 outline outline-1 -outline-offset-1 outline-base-content/20' },
		maintenance: { label: 'Maintenance', cls: 'badge-warning badge-soft outline outline-1 -outline-offset-1 outline-warning/30' }
	};

	const config = $derived(CONFIG[normalized] ?? { label: 'Unknown', cls: 'badge-ghost' });
</script>

<span class="badge {config.cls} font-mono text-[10px] tracking-wider uppercase">
	{config.label}
</span>
