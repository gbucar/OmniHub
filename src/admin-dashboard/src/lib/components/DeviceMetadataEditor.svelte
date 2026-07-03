<script lang="ts">
	/**
	 * Key/value editor for the `data.sensors.properties` JSONB column.
	 *
	 * The `status` key is special-cased: it is rendered and edited in the
	 * Information card of `DeviceDetailsPanel`, so it must be hidden here to
	 * avoid two sources of truth writing to the same field.
	 *
	 * The component is uncontrolled in the sense that it maintains its own
	 * local working copy (`local`) and only writes back to the parent
	 * `bind:metadata` on user action (add/remove) or when the parent resets
	 * it via a `key`-like change. This keeps two-way binding predictable.
	 */
	interface Props {
		metadata: Record<string, unknown>;
		disabled?: boolean;
	}

	let { metadata = $bindable(), disabled = false }: Props = $props();

	const RESERVED_KEYS = new Set(['status']);

	type Entry = { id: string; key: string; value: string };
	let entries = $state<Entry[]>([]);
	let lastSyncedJson = '';

	// Stable id counter so Svelte's keyed each blocks don't churn on edits.
	let nextId = 0;
	const makeId = () => `md-${++nextId}`;

	/** Serialise the current `metadata` object to a canonical JSON string for change detection. */
	const canonical = (obj: Record<string, unknown>): string => {
		// Drop reserved keys + sort by key so the resulting JSON is stable.
		const filtered: Record<string, unknown> = {};
		for (const k of Object.keys(obj)) {
			if (RESERVED_KEYS.has(k)) continue;
			filtered[k] = obj[k];
		}
		return JSON.stringify(filtered, Object.keys(filtered).sort());
	};

	/** Initialise / reconcile `entries` from the bound `metadata` prop. */
	const syncFromMetadata = () => {
		const json = canonical(metadata);
		if (json === lastSyncedJson) return;
		lastSyncedJson = json;

		const next: Entry[] = [];
		for (const k of Object.keys(metadata)) {
			if (RESERVED_KEYS.has(k)) continue;
			const v = metadata[k];
			next.push({ id: makeId(), key: k, value: formatValue(v) });
		}
		// Stable, predictable ordering.
		next.sort((a, b) => a.key.localeCompare(b.key));
		entries = next;
	};

	/** Stringify any value for display in the input. */
	const formatValue = (v: unknown): string => {
		if (v === null || v === undefined) return '';
		if (typeof v === 'string') return v;
		return JSON.stringify(v);
	};

	/** Re-parse a string entry into a JS value (string / number / bool / null). */
	const parseValue = (raw: string): unknown => {
		const trimmed = raw.trim();
		if (trimmed === '') return '';
		if (trimmed === 'true') return true;
		if (trimmed === 'false') return false;
		if (trimmed === 'null') return null;
		// Try integer / float
		const num = Number(trimmed);
		if (!Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
			return num;
		}
		return trimmed;
	};

	/** Push `entries` back to the bound `metadata`, preserving reserved keys. */
	const commit = () => {
		const next: Record<string, unknown> = {};
		// Preserve reserved keys from the existing metadata.
		for (const k of Object.keys(metadata)) {
			if (RESERVED_KEYS.has(k)) next[k] = metadata[k];
		}
		for (const e of entries) {
			const key = e.key.trim();
			if (key === '') continue;
			if (RESERVED_KEYS.has(key)) continue;
			// Last write wins on duplicate keys.
			next[key] = parseValue(e.value);
		}
		metadata = next;
		lastSyncedJson = canonical(next);
	};

	const addField = () => {
		entries = [...entries, { id: makeId(), key: '', value: '' }];
	};

	const removeField = (id: string) => {
		entries = entries.filter((e) => e.id !== id);
		commit();
	};

	const onKeyChange = (id: string, newKey: string) => {
		entries = entries.map((e) => (e.id === id ? { ...e, key: newKey } : e));
		commit();
	};

	const onValueChange = (id: string, newValue: string) => {
		entries = entries.map((e) => (e.id === id ? { ...e, value: newValue } : e));
		commit();
	};

	$effect(() => {
		// Re-sync whenever the parent's `metadata` object identity changes.
		void metadata;
		syncFromMetadata();
	});
</script>

<div class="space-y-2">
	{#each entries as entry (entry.id)}
		<div class="grid grid-cols-[1fr_1.5fr_auto] items-center gap-2">
			<input
				type="text"
				class="input-bordered input input-sm w-full font-mono"
				placeholder="key"
				value={entry.key}
				{disabled}
				oninput={(e) => onKeyChange(entry.id, (e.currentTarget as HTMLInputElement).value)}
				aria-label="Metadata key"
			/>
			<input
				type="text"
				class="input-bordered input input-sm w-full font-mono"
				placeholder="value"
				value={entry.value}
				{disabled}
				oninput={(e) => onValueChange(entry.id, (e.currentTarget as HTMLInputElement).value)}
				aria-label="Metadata value"
			/>
			<button
				type="button"
				class="btn btn-square text-base-content/40 btn-ghost btn-sm hover:text-error"
				onclick={() => removeField(entry.id)}
				{disabled}
				aria-label="Remove field"
			>
				<svg
					class="h-3.5 w-3.5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
					/>
				</svg>
			</button>
		</div>
	{/each}

	<button
		type="button"
		class="btn w-full font-mono text-base-content/50 btn-ghost btn-sm"
		onclick={addField}
		{disabled}
	>
		<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M12 5v14M5 12h14" />
		</svg>
		Add field
	</button>
</div>
