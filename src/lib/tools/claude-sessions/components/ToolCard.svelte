<script lang="ts">
	// Phase 3 (item 16) — 도구 호출/결과 카드 (design prompt 75·77·16행)
	// `summarizeToolInput`/`truncateLines`를 재사용한다(transcript-viewer, 수정 금지).
	// 시각 근거: zip `<details>` 접힘 카드(612~626) + mono 경로 표기(386~389), 오류 배너 색(277~284)
	//
	// Phase 4가 참조할 계약: expandSignal/expandValue는 ThinkingCard와 동일 계약(전체 펼치기/접기 전파).
	//
	// input/result 본문은 마크다운이 아니라 원문 텍스트(JSON/로그)이므로 TextContent(marked 렌더)를
	// 거치지 않는다 — Svelte의 `{expr}` 텍스트 보간은 항상 이스케이프되므로 `{@html}` 없이 그대로
	// 출력해도 안전하다(마크다운 렌더 경로가 아니므로 DOMPurify 대상이 아니다).
	import { AlertTriangle, ChevronDown, ChevronRight, Wrench } from 'lucide-svelte';
	import type { ToolUseBlock } from '$lib/tools/transcript-viewer/types.js';
	import { summarizeToolInput } from '$lib/tools/transcript-viewer/toolSummary.js';
	import { truncateLines } from '$lib/tools/transcript-viewer/truncate.js';

	let {
		block,
		expandSignal,
		expandValue
	}: {
		block: ToolUseBlock;
		expandSignal?: number;
		expandValue?: boolean;
	} = $props();

	let expanded = $state(false);
	let lastSignal = 0;
	let inputFullyShown = $state(false);
	let resultFullyShown = $state(false);

	$effect(() => {
		if (expandSignal !== undefined && expandSignal !== lastSignal) {
			lastSignal = expandSignal;
			expanded = expandValue ?? expanded;
		}
	});

	const MAX_LINES = 40;
	const MAX_CHARS = 4000;

	const isError = $derived(block.result?.is_error === true);
	const summary = $derived(summarizeToolInput(block.name, block.input));

	function formatInput(input: unknown): string {
		if (input === undefined) return '';
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
					if (c && typeof c === 'object' && 'text' in c && typeof (c as { text?: unknown }).text === 'string') {
						return (c as { text: string }).text;
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

	const inputText = $derived(formatInput(block.input));
	const inputTruncated = $derived(truncateLines(inputText, MAX_LINES, MAX_CHARS));
	const inputDisplay = $derived(
		inputFullyShown || inputTruncated.hiddenLineCount === 0 ? inputText : inputTruncated.shown
	);

	const resultText = $derived(block.result ? formatResultContent(block.result.content) : '');
	const resultTruncated = $derived(truncateLines(resultText, MAX_LINES, MAX_CHARS));
	const resultDisplay = $derived(
		resultFullyShown || resultTruncated.hiddenLineCount === 0 ? resultText : resultTruncated.shown
	);
</script>

<div class="rounded-xl border {isError ? 'border-warning/40 bg-warning-soft' : 'border-border bg-surface'}">
	<button
		type="button"
		class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium transition-colors hover:bg-secondary/60 focus:outline-none focus:ring-2 focus:ring-ring/40 {isError
			? 'text-warning-foreground'
			: 'text-muted-foreground'}"
		onclick={() => (expanded = !expanded)}
	>
		{#if expanded}
			<ChevronDown class="size-3.5" aria-hidden="true" />
		{:else}
			<ChevronRight class="size-3.5" aria-hidden="true" />
		{/if}
		{#if isError}
			<AlertTriangle class="size-3.5" aria-hidden="true" />
		{:else}
			<Wrench class="size-3.5" aria-hidden="true" />
		{/if}
		<span class="shrink-0 font-mono">{block.name || 'tool'}</span>
		{#if summary}
			<span class="truncate text-muted-foreground">{summary}</span>
		{/if}
		{#if isError}
			<span class="ml-auto shrink-0 rounded-sm bg-warning-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-warning-foreground">
				오류
			</span>
		{/if}
	</button>
	{#if expanded}
		<div class="border-t border-border px-4 py-3 text-xs">
			{#if block.input !== undefined}
				<div class="mb-1 font-semibold text-muted-foreground">input</div>
				<pre class="mb-1 overflow-x-auto rounded-md bg-background p-2 font-mono text-xs text-foreground">{inputDisplay}</pre>
				{#if inputTruncated.hiddenLineCount > 0 && !inputFullyShown}
					<button
						type="button"
						class="mb-2 text-[11px] font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
						onclick={() => (inputFullyShown = true)}
					>
						{inputTruncated.hiddenLineCount}줄 더 보기
					</button>
				{/if}
			{/if}
			{#if block.result}
				<div class="mb-1 flex items-center justify-between font-semibold text-muted-foreground">
					<span>result</span>
					<span class="font-mono font-normal text-[10px] tabular-nums">
						{resultTruncated.totalLines}줄 / {resultTruncated.totalChars}자
					</span>
				</div>
				<pre class="overflow-x-auto rounded-md bg-background p-2 font-mono text-xs text-foreground">{resultDisplay}</pre>
				{#if resultTruncated.hiddenLineCount > 0 && !resultFullyShown}
					<button
						type="button"
						class="mt-1 text-[11px] font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
						onclick={() => (resultFullyShown = true)}
					>
						{resultTruncated.hiddenLineCount}줄 더 보기
					</button>
				{/if}
			{:else}
				<div class="italic text-muted-foreground">일치하는 tool_result 없음</div>
			{/if}
		</div>
	{/if}
</div>
