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
		active: { label: 'Active', cls: 'badge-success badge-soft' },
		inactive: { label: 'Inactive', cls: 'badge-outline badge-neutral !text-base-content/60' },
		maintenance: { label: 'Maintenance', cls: 'badge-warning badge-soft' }
	};

	const config = $derived(CONFIG[normalized] ?? { label: 'Unknown', cls: 'badge-ghost' });
</script>

<span class="badge {config.cls} font-mono text-[10px] tracking-wider uppercase">
	{config.label}
</span>
