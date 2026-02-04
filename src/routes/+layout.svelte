<script lang="ts">
	import { Toaster } from 'svelte-sonner';
	import '../app.css';

	let { children } = $props();
</script>

<Toaster position="top-center" />

<div class="min-h-screen bg-white">
	{@render children()}
</div>
