<script lang="ts">
	import { user } from '$lib/api';
</script>

<svelte:head>
	<title>Dashboard — OmniHub</title>
</svelte:head>

<div class="relative h-full overflow-hidden bg-base-100">
	<div
		class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent"
	></div>

	{#if $user.isLoggedIn}
		<div class="relative z-10 flex h-full flex-col items-center justify-center p-8">
			<div class="card max-w-lg bg-base-200 shadow-2xl">
				<div class="card-body items-center p-8 text-center">
					<div class="relative mb-6">
						<div
							class="flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 shadow-lg shadow-primary/10"
						>
							<span class="font-display text-4xl font-bold text-primary">Ω</span>
						</div>
						<div
							class="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-base-200 bg-accent"
						>
							<svg
								class="h-3 w-3 text-accent-content"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="3"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
						</div>
					</div>

					<h1 class="font-display mb-2 text-3xl font-bold">
						Welcome, <span class="text-primary">{$user.username}</span>
					</h1>
					<p class="mb-8 text-base-content/50">
						You have access to the research administration dashboard
					</p>

					<a href="/users" class="btn btn-wide btn-primary">
						<span>Participant Overview</span>
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M5 12h14M12 5l7 7-7 7" />
						</svg>
					</a>
				</div>
			</div>
		</div>
	{:else}
		<div class="flex h-full items-center justify-center">
			<div class="card bg-base-200 shadow-xl">
				<div class="card-body items-center p-8 text-center">
					<div
						class="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-neutral/20 bg-base-300"
					>
						<svg
							class="h-6 w-6 text-base-content/50"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<circle cx="12" cy="12" r="10" />
							<path d="M12 8v4M12 16h.01" />
						</svg>
					</div>
					<p class="mb-4 text-base-content/50">Please log in to access the dashboard</p>
					<a href="/auth/login" class="btn btn-primary"> Sign In </a>
				</div>
			</div>
		</div>
	{/if}
</div>
