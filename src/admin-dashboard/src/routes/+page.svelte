<script lang="ts">
	import { user } from '$lib/api';
</script>

<div class="flex h-full flex-col items-center justify-center bg-base-200">
	{#if $user.isLoggedIn}
		<h2 class="text-2xl">Dobrodošli, {$user.username}!</h2>
		<a href="/users" class="btn btn-primary">Pregled uporabnikov</a>
	{:else}
		<div class="text-center">
			<p class="mb-4">Prosimo, <a href="/auth/login" class="link link-primary">prijavite se</a>.</p>
		</div>
	{/if}
</div>
