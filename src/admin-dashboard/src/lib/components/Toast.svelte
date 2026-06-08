<script lang="ts">
	import { toast, hideToast } from '$lib/stores/toast';
</script>

{#if $toast.visible}
	<div class="toast toast-start toast-bottom z-50">
		<div
			class="toast-animate alert shadow-lg {$toast.type === 'success'
				? 'alert-success'
				: 'alert-error'}"
		>
			<span class="font-mono text-sm">{$toast.message}</span>
			<button
				onclick={() => hideToast()}
				class="btn btn-circle btn-ghost btn-xs"
				aria-label="Close notification"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>
{/if}
