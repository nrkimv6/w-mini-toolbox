<script lang="ts">
	import { Cpu, MessageSquare, Coins, GitBranch, Database } from 'lucide-svelte';
	import type { TranscriptMeta } from '../types.js';
	import { computeCacheHitRate } from '../stats.js';

	interface Props {
		meta: TranscriptMeta;
	}

	let { meta }: Props = $props();

	const totalTokens = $derived(
		meta.totalInputTokens + meta.totalOutputTokens + meta.totalCacheCreationTokens + meta.totalCacheReadTokens
	);

	// 캐시 적중률 = cache_read / (cache_read + input). 분모가 0이면 표시하지 않는다(null 방어).
	const cacheHitRate = $derived(computeCacheHitRate(meta));
</script>

<div class="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600">
	<div class="flex items-center gap-1.5">
		<MessageSquare size={14} class="text-purple-500" />
		<span>메시지 {meta.totalMessages.toLocaleString()}개</span>
	</div>
	<div class="flex items-center gap-1.5">
		<Coins size={14} class="text-amber-500" />
		<span>토큰 합계 {totalTokens.toLocaleString()}</span>
		<span class="text-gray-400"
			>(in {meta.totalInputTokens.toLocaleString()} / out {meta.totalOutputTokens.toLocaleString()})</span
		>
	</div>
	{#if cacheHitRate !== null}
		<div class="flex items-center gap-1.5">
			<Database size={14} class="text-teal-500" />
			<span>캐시 적중률 {(cacheHitRate * 100).toFixed(1)}%</span>
		</div>
	{/if}
	{#if meta.models.length > 0}
		<div class="flex items-center gap-1.5">
			<Cpu size={14} class="text-blue-500" />
			<span>{meta.models.join(', ')}</span>
		</div>
	{/if}
	{#if meta.gitBranch}
		<div class="flex items-center gap-1.5">
			<GitBranch size={14} class="text-green-500" />
			<span>{meta.gitBranch}</span>
		</div>
	{/if}
	{#if meta.sessionId}
		<div class="text-gray-400">session: {meta.sessionId}</div>
	{/if}
</div>
