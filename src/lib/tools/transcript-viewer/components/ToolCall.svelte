<script lang="ts">
	import { ChevronDown, ChevronRight, Wrench, AlertTriangle } from 'lucide-svelte';
	import type { ToolUseBlock } from '../types.js';

	interface Props {
		block: ToolUseBlock;
		/** 상위(페이지)에서 "전체 펼치기/접기"를 트리거하기 위한 신호. 값이 바뀔 때마다 expandValue를 적용한다. */
		expandSignal?: number;
		expandValue?: boolean;
	}

	let { block, expandSignal, expandValue }: Props = $props();
	let expanded = $state(false);
	let lastSignal = -1;

	$effect(() => {
		if (expandSignal !== undefined && expandSignal !== lastSignal) {
			lastSignal = expandSignal;
			expanded = expandValue ?? expanded;
		}
	});

	const isError = $derived(block.result?.is_error === true);

	function formatInput(input: unknown): string {
		if (input == null) return '';
		try {
			return JSON.stringify(input, null, 2);
		} catch {
			return String(input);
		}
	}

	function formatResultContent(content: unknown): string {
		if (content == null) return '';
		if (typeof content === 'string') return content;
		if (Array.isArray(content)) {
			return content
				.map((c) => {
					if (c && typeof c === 'object' && 'text' in c && typeof (c as any).text === 'string') {
						return (c as any).text;
					}
					try {
						return JSON.stringify(c);
					} catch {
						return String(c);
					}
				})
				.join('\n');
		}
		try {
			return JSON.stringify(content, null, 2);
		} catch {
			return String(content);
		}
	}
</script>

<div
	class="my-2 rounded-lg border {isError
		? 'border-red-300 bg-red-50/60'
		: 'border-blue-200 bg-blue-50/60'}"
>
	<button
		type="button"
		class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium {isError
			? 'text-red-700 hover:bg-red-100/60'
			: 'text-blue-700 hover:bg-blue-100/60'}"
		onclick={() => (expanded = !expanded)}
	>
		{#if expanded}
			<ChevronDown size={14} />
		{:else}
			<ChevronRight size={14} />
		{/if}
		{#if isError}
			<AlertTriangle size={14} />
		{:else}
			<Wrench size={14} />
		{/if}
		<span>{block.name || 'tool'}</span>
		{#if isError}
			<span class="ml-auto rounded-full bg-red-200 px-2 py-0.5 text-[10px] text-red-800">error</span>
		{/if}
	</button>
	{#if expanded}
		<div class="border-t {isError ? 'border-red-200' : 'border-blue-200'} px-3 py-2 text-xs">
			{#if block.input !== undefined}
				<div class="mb-1 font-semibold text-gray-500">input</div>
				<pre class="mb-2 overflow-x-auto rounded bg-gray-900 p-2 text-gray-100">{formatInput(block.input)}</pre>
			{/if}
			{#if block.result}
				<div class="mb-1 font-semibold text-gray-500">result</div>
				<pre
					class="overflow-x-auto rounded p-2 {isError
						? 'bg-red-900 text-red-50'
						: 'bg-gray-900 text-gray-100'}">{formatResultContent(block.result.content)}</pre>
			{:else}
				<div class="italic text-gray-400">(matching tool_result 없음)</div>
			{/if}
		</div>
	{/if}
</div>
