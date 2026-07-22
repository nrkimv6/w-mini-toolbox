<script lang="ts">
	import { tools } from '$lib/data';
	import { FileText, Smartphone, ScrollText } from 'lucide-svelte';
	import type { ComponentType } from 'svelte';
	import { APP_VERSION } from '$lib/config';

	// Icon mapping
	const iconMap: Record<string, ComponentType> = {
		FileText,
		Smartphone,
		ScrollText
	};
</script>

<svelte:head>
	<title>Mini Toolbox</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center px-4">
	<h1 class="mb-2 text-3xl font-bold">Mini Toolbox</h1>
	<p class="mb-8 text-gray-500">가볍고 빠른 웹 도구 모음</p>

	<div class="grid w-full max-w-md gap-4">
		{#each tools as tool}
			{@const Icon = iconMap[tool.icon] || FileText}
			<a
				href={tool.href}
				class="flex items-center gap-4 rounded-xl border border-gray-200 p-4 transition-colors hover:bg-gray-50"
			>
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
					<Icon class="h-5 w-5 text-gray-600" />
				</div>
				<div>
					<h2 class="font-semibold">{tool.name}</h2>
					<p class="text-sm text-gray-500">{tool.description}</p>
				</div>
			</a>
		{/each}
	</div>
	<p class="mt-8 text-xs text-gray-400">v{APP_VERSION}</p>
</div>
