<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props {
		value: string;
		id?: string;
		name?: string;
		placeholder?: string;
		required?: boolean;
		class?: string;
		autocomplete?: HTMLInputAttributes['autocomplete'];
	}

	let {
		value = $bindable(''),
		id,
		name,
		placeholder = '',
		required = false,
		class: extraClass = '',
		autocomplete = 'current-password'
	}: Props = $props();

	let visible = $state(false);

	const toggle = () => {
		visible = !visible;
	};
</script>

<div class="relative">
	<input
		{id}
		{name}
		bind:value
		type={visible ? 'text' : 'password'}
		{placeholder}
		{required}
		{autocomplete}
		class="input-bordered input w-full {extraClass} pr-10"
	/>
	<button
		type="button"
		onclick={toggle}
		class="btn absolute top-1/2 right-1 btn-circle -translate-y-1/2 btn-ghost btn-xs"
		aria-label={visible ? 'Hide password' : 'Show password'}
		aria-pressed={visible}
		tabindex="-1"
	>
		{#if visible}
			<!-- eye-off icon -->
			<svg
				class="h-4 w-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
				<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
				<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
				<line x1="1" y1="1" x2="23" y2="23" />
			</svg>
		{:else}
			<!-- eye icon -->
			<svg
				class="h-4 w-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
				<circle cx="12" cy="12" r="3" />
			</svg>
		{/if}
	</button>
</div>
