<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="flex h-screen w-screen flex-col items-center justify-center bg-base-200">
	<div class="card w-96 bg-base-100 shadow-xl">
		<div class="card-body items-center text-center">
			<h2 class="card-title text-4xl text-error">{page.status}</h2>
			<p class="text-base-content/70">{page.error?.message ?? 'An unexpected error occurred'}</p>
			<div class="mt-4 card-actions">
				<a href="/" class="btn btn-primary">Go Home</a>
			</div>
		</div>
	</div>
</div>
