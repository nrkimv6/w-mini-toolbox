<script lang="ts">
	// Phase 3 (item 16) — 도구 호출/결과 카드 (design prompt 75·77·16행)
	// `summarizeToolInput`/`truncateLines`를 재사용한다(transcript-viewer, 수정 금지).
	// 시각 근거: zip `<details>` 접힘 카드(612~626) + mono 경로 표기(386~389), 오류 배너 색(277~284)
	//
	// Phase 4가 참조할 계약: expandSignal/expandValue는 ThinkingCard와 동일 계약(전체 펼치기/접기 전파).
	//
	// input/result 본문은 마크다운이 아니라 원문 텍스트(JSON/로그)이므로 TextContent(marked 렌더)를
	// 거치지 않는다 — Svelte의 `{expr}` 텍스트 보간은 항상 이스케이프되므로 `{@html}` 없이 그대로
	// 출력해도 안전하다(마크다운 렌더 경로가 아니므로 DOMPurify 대상이 아니다). 하이라이트도 같은
	// 이유로 TreeWalker가 아니라 순수 문자열 분할(`highlightSegments`) + `{#each}` 템플릿 렌더로
	// 처리한다 — `{@html}`을 쓰지 않으므로 XSS 표면이 애초에 생기지 않는다.
	//
	// Phase 5 (item 12) — 접힌 카드 자동 펼침 OR 합성 (design prompt 139행, 갈음 불가 계약).
	// `userExpanded`(사용자 개별 클릭으로만 바뀜)와 `hasMatch`(검색 매칭)를 분리 보관하고, 렌더
	// 시점에만 `userExpanded || (searchActive && hasMatch && !userCollapsedDuringSearch)`로
	// 합성한다. `userExpanded`에 직접 대입하지 않는다 — 검색이 끝나면(query가 비면) 자동 펼침
	// 효과가 사라지고 사용자가 마지막으로 남긴 `userExpanded` 상태만 남아야 하기 때문이다.
	//
	// 세 입력의 우선순위(최근 조작이 이긴다):
	//   1. 사용자 개별 클릭(`toggleExpanded`) — 즉시 반영
	//   2. "모두 펼치기/접기" 신호(`expandSignal`) — 발생 시 `userExpanded`를 덮어쓰고
	//      `userCollapsedDuringSearch`도 그 값에 맞춰 재설정한다(전체 접기는 검색 자동 펼침도
	//      함께 억제해야 "모두 접기"가 이름 그대로 동작한다)
	//   3. 검색 자동 펼침 — 위 두 입력이 명시적으로 접지 않은 경우에만 OR로 열림에 기여한다
	// 검색어가 바뀌면(`query` 변경) `userCollapsedDuringSearch`를 초기화한다 — 새 검색어 기준으로
	// 다시 자동 펼침이 적용돼야 한다.
	import { getContext } from 'svelte';
	import { AlertTriangle, ChevronDown, ChevronRight, Wrench } from 'lucide-svelte';
	import type { ToolUseBlock } from '$lib/tools/transcript-viewer/types.js';
	import { summarizeToolInput } from '$lib/tools/transcript-viewer/toolSummary.js';
	import { truncateLines } from '$lib/tools/transcript-viewer/truncate.js';
	import { matchesToolUse, SEARCH_CONTEXT_KEY } from '$lib/tools/transcript-viewer/search.js';
	import type { DetailSearchContext } from '../searchNav.js';

	let {
		block,
		lineIndex,
		expandSignal,
		expandValue
	}: {
		block: ToolUseBlock;
		/** 이 카드가 속한 메시지의 lineIndex. "현재 확인 중인 일치" 강조 판단에 쓴다. */
		lineIndex?: number;
		expandSignal?: number;
		expandValue?: boolean;
	} = $props();

	const searchCtx = getContext<DetailSearchContext | undefined>(SEARCH_CONTEXT_KEY);
	const needle = $derived((searchCtx?.query ?? '').trim().toLowerCase());
	const searchActive = $derived(needle.length > 0);
	const hasMatch = $derived(searchActive && matchesToolUse(block, needle));
	const isCurrent = $derived(
		lineIndex !== undefined && searchCtx !== undefined && searchCtx.currentLineIndex === lineIndex
	);

	let userExpanded = $state(false);
	let userCollapsedDuringSearch = $state(false);
	let lastSignal = 0;
	let lastQuery = '';
	let inputFullyShown = $state(false);
	let resultFullyShown = $state(false);

	const expanded = $derived(userExpanded || (searchActive && hasMatch && !userCollapsedDuringSearch));

	function toggleExpanded() {
		if (expanded) {
			userExpanded = false;
			if (searchActive && hasMatch) userCollapsedDuringSearch = true;
		} else {
			userExpanded = true;
			userCollapsedDuringSearch = false;
		}
	}

	$effect(() => {
		if (expandSignal !== undefined && expandSignal !== lastSignal) {
			lastSignal = expandSignal;
			const value = expandValue ?? userExpanded;
			userExpanded = value;
			userCollapsedDuringSearch = !value;
		}
	});

	$effect(() => {
		const q = searchCtx?.query ?? '';
		if (q !== lastQuery) {
			lastQuery = q;
			userCollapsedDuringSearch = false;
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

	/** item 11 — 도구명·입력(그리고 일관성을 위해 결과도) 안의 일치 구간을 순수 문자열 분할로
	 * 나눈다. `{@html}`을 쓰지 않고 `{#each}` 템플릿으로만 렌더하므로 이 텍스트가 그대로
	 * 이스케이프되어 출력된다(XSS 표면 없음). */
	function highlightSegments(text: string, ndl: string): { text: string; match: boolean }[] {
		if (!ndl) return [{ text, match: false }];
		const lower = text.toLowerCase();
		const segments: { text: string; match: boolean }[] = [];
		let cursor = 0;
		let idx = lower.indexOf(ndl, cursor);
		while (idx !== -1) {
			if (idx > cursor) segments.push({ text: text.slice(cursor, idx), match: false });
			segments.push({ text: text.slice(idx, idx + ndl.length), match: true });
			cursor = idx + ndl.length;
			idx = lower.indexOf(ndl, cursor);
		}
		if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
		return segments;
	}
</script>

<div class="rounded-xl border {isError ? 'border-warning/40 bg-warning-soft' : 'border-border bg-surface'}">
	<button
		type="button"
		class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium transition-colors hover:bg-secondary/60 focus:outline-none focus:ring-2 focus:ring-ring/40 {isError
			? 'text-warning-foreground'
			: 'text-muted-foreground'}"
		onclick={toggleExpanded}
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
		<span class="shrink-0 font-mono">
			{#each highlightSegments(block.name || 'tool', needle) as seg, i (i)}
				{#if seg.match}
					<mark class={isCurrent ? 'cse-mark bg-primary text-primary-foreground' : 'cse-mark'}>{seg.text}</mark>
				{:else}
					{seg.text}
				{/if}
			{/each}
		</span>
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
				<pre class="mb-1 overflow-x-auto rounded-md bg-background p-2 font-mono text-xs text-foreground">{#each highlightSegments(inputDisplay, needle) as seg, i (i)}{#if seg.match}<mark class={isCurrent ? 'cse-mark bg-primary text-primary-foreground' : 'cse-mark'}>{seg.text}</mark>{:else}{seg.text}{/if}{/each}</pre>
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
				<pre class="overflow-x-auto rounded-md bg-background p-2 font-mono text-xs text-foreground">{#each highlightSegments(resultDisplay, needle) as seg, i (i)}{#if seg.match}<mark class={isCurrent ? 'cse-mark bg-primary text-primary-foreground' : 'cse-mark'}>{seg.text}</mark>{:else}{seg.text}{/if}{/each}</pre>
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

<style>
	.cse-mark {
		border-radius: 0.15rem;
		padding: 0 0.05rem;
	}
	.cse-mark:not(.bg-primary) {
		background: hsl(50 100% 55% / 0.65);
		color: inherit;
	}
</style>
