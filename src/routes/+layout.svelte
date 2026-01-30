<script lang="ts">
	import { onMount } from 'svelte';
	import { Toaster } from 'svelte-sonner';
	import '../app.css';
	import { authStore } from '$lib/stores/auth.svelte';

	let { children } = $props();

	onMount(async () => {
		await authStore.initialize();
	});
</script>

<Toaster position="top-center" />

<div class="min-h-screen bg-white">
	{#if authStore.loading}
		<div class="flex h-screen items-center justify-center">
			<div class="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
		</div>
	{:else}
		{@render children()}
	{/if}
</div>
