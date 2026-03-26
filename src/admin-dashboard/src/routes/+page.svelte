<script lang="ts">
	import { user } from '$lib/api';
</script>

<div class="flex min-h-screen items-center justify-center bg-base-200">
	{#if $user.isLoggedIn}
		<a href="/users" class="btn btn-primary">Pregled uporabnikov</a>
	{:else}
		<div class="text-center">
			<p class="mb-4">Prosimo, <a href="/auth/login" class="link link-primary">prijavite se</a>.</p>
		</div>
	{/if}
</div>
