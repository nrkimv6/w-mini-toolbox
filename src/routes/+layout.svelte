<script lang="ts">
	import { onMount } from 'svelte';
	import { Toaster } from 'svelte-sonner';
	import '../app.css';
	import { authStore } from '$lib/stores/auth.svelte';

	let { children } = $props();

	onMount(() => {
		authStore.initialize();
	});
</script>

<Toaster position="top-center" />

<div class="min-h-screen bg-white">
	{@render children()}
</div>
