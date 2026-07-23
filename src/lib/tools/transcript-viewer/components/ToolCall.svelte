<script lang="ts">
	import { ChevronDown, ChevronRight, Wrench, AlertTriangle } from 'lucide-svelte';
	import type { ToolUseBlock } from '../types.js';
	import { summarizeToolInput } from '../toolSummary.js';
	import { truncateLines } from '../truncate.js';

	interface Props {
		block: ToolUseBlock;
		/** 상위(페이지)에서 "전체 펼치기/접기"를 트리거하기 위한 신호. 값이 바뀔 때마다 expandValue를 적용한다. */
		expandSignal?: number;
		expandValue?: boolean;
	}

	let { block, expandSignal, expandValue }: Props = $props();
	let expanded = $state(false);
	let lastSignal = 0;

	// truncate 해제 상태는 카드 펼침(expanded)과 별개의 로컬 state로 유지한다.
	// 전역 expandSignal("모두 펼치기")이 이 상태까지 전파되지 않도록 별도 관리한다 (설계 결정 3).
	let resultFullyShown = $state(false);
	let inputFullyShown = $state(false);

	$effect(() => {
		if (expandSignal !== undefined && expandSignal !== lastSignal) {
			lastSignal = expandSignal;
			expanded = expandValue ?? expanded;
		}
	});

	const isError = $derived(block.result?.is_error === true);
	const summary = $derived(summarizeToolInput(block.name, block.input));
	const errorPreview = $derived(
		isError ? clampErrorPreview(firstNonEmptyLine(formatResultContent(block.result?.content))) : null
	);

	const MAX_ERROR_PREVIEW_LENGTH = 60;
	const MAX_RESULT_LINES = 40;
	const MAX_RESULT_CHARS = 4000;
	const MAX_INPUT_LINES = 40;
	const MAX_INPUT_CHARS = 4000;

	const resultText = $derived(block.result ? formatResultContent(block.result.content) : '');
	const resultTruncated = $derived(truncateLines(resultText, MAX_RESULT_LINES, MAX_RESULT_CHARS));
	const resultDisplay = $derived(
		resultFullyShown || resultTruncated.hiddenLineCount === 0 ? resultText : resultTruncated.shown
	);

	const inputText = $derived(block.input !== undefined ? formatInput(block.input) : '');
	const inputTruncated = $derived(truncateLines(inputText, MAX_INPUT_LINES, MAX_INPUT_CHARS));
	const inputDisplay = $derived(
		inputFullyShown || inputTruncated.hiddenLineCount === 0 ? inputText : inputTruncated.shown
	);

	function firstNonEmptyLine(text: string): string {
		const line = text.split('\n').find((l) => l.trim().length > 0);
		return (line ?? text.split('\n')[0] ?? '').trim();
	}

	function clampErrorPreview(text: string): string {
		if (text.length <= MAX_ERROR_PREVIEW_LENGTH) return text;
		return text.slice(0, MAX_ERROR_PREVIEW_LENGTH - 1).trimEnd() + '…';
	}

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

<!-- 색상 톤: 웹 테마 한정 중립화 (Phase 2). CLI 테마 분기는 cli-theme plan 소관이며 이 파일에 CLI 분기가 생기면 절대 건드리지 말 것. -->
<div class="my-2 rounded-lg border border-gray-200 bg-gray-50/60">
	<button
		type="button"
		class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-gray-100"
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
		<span class="shrink-0">{block.name || 'tool'}</span>
		{#if summary}
			<span class="truncate text-gray-400">{summary}</span>
		{/if}
		{#if isError}
			<span class="ml-auto flex shrink-0 items-center gap-1.5">
				{#if errorPreview}
					<span class="max-w-[16rem] truncate text-[10px] text-amber-700">{errorPreview}</span>
				{/if}
				<span class="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] text-amber-700">error</span>
			</span>
		{/if}
	</button>
	{#if expanded}
		<div class="border-t border-gray-200 px-3 py-2 text-xs">
			{#if block.input !== undefined}
				<div class="mb-1 font-semibold text-gray-500">input</div>
				<pre class="mb-1 overflow-x-auto rounded bg-gray-900 p-2 text-gray-100">{inputDisplay}</pre>
				{#if inputTruncated.hiddenLineCount > 0 && !inputFullyShown}
					<button
						type="button"
						class="mb-2 text-[11px] text-blue-600 hover:underline"
						onclick={() => (inputFullyShown = true)}
					>
						{inputTruncated.hiddenLineCount}줄 더 보기
					</button>
				{/if}
			{/if}
			{#if block.result}
				<div class="mb-1 flex items-center justify-between font-semibold text-gray-500">
					<span>result</span>
					<span class="font-normal text-gray-400"
						>{resultTruncated.totalLines}줄 / {resultTruncated.totalChars}자</span
					>
				</div>
				<pre class="overflow-x-auto rounded bg-gray-900 p-2 text-gray-100">{resultDisplay}</pre>
				{#if resultTruncated.hiddenLineCount > 0 && !resultFullyShown}
					<button
						type="button"
						class="mt-1 text-[11px] text-blue-600 hover:underline"
						onclick={() => (resultFullyShown = true)}
					>
						{resultTruncated.hiddenLineCount}줄 더 보기
					</button>
				{/if}
			{:else}
				<div class="italic text-gray-400">(matching tool_result 없음)</div>
			{/if}
		</div>
	{/if}
</div>
