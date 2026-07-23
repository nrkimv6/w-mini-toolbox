<script lang="ts">
	// Phase 3 (item 15) — 사고 내용 카드, 기본 접힘 (design prompt 75·77행)
	// 시각 근거: zip `<details>` 접힘 카드(612~626) + 카드 컨테이너 `rounded-xl border border-border
	// bg-surface`(314, 357)
	//
	// Phase 4가 참조할 계약:
	//   - `expandSignal`(number, 매번 증가)/`expandValue`(boolean)는 DetailToolbar의 "모두 펼치기/접기"를
	//     전파하는 신호다. 값이 바뀔 때만(신호가 "새로" 왔을 때만) 로컬 `expanded`를 덮어쓴다 — 사용자가
	//     수동으로 접었다 폈다 한 뒤에는 다음 전체 신호가 오기 전까지 로컬 상태를 그대로 둔다.
	//   - 사고 내용(prose)은 TextContent를 통해 렌더한다 — 어시스턴트가 생성한 텍스트도 마크다운을
	//     포함할 수 있어 동일한 sanitize 계약이 적용돼야 하므로.
	//
	// Phase 5 (item 13) — ToolCard(item 12)와 동일한 OR 합성 규칙을 적용한다. 판정은 `thinking`
	// 텍스트 부분일치(대소문자 무시)로 한다 — `matchesQuery`/`matchesToolUse`는 ContentBlock 전체
	// 또는 ToolUseBlock 전용이라 이 블록(thinking 문자열 자체)에는 맞지 않으므로, 이 컴포넌트가
	// 직접 `thinking.toLowerCase().includes(needle)`로 판정한다(search.ts와 동일한 대소문자 무시
	// 규칙을 그대로 따름).
	//
	// 세 입력(사용자 개별 / 전체 신호 / 검색)의 우선순위 — ToolCard와 동일한 규칙:
	//   | 우선순위 | 입력 | 동작 |
	//   |---|---|---|
	//   | 1 (최우선, 즉시 반영) | 사용자 개별 클릭 | `userExpanded` 토글. 검색으로 열려 있던 카드를
	//   |          |          | 닫으면 `userCollapsedDuringSearch=true`로 검색 자동 펼침도 함께 억제 |
	//   | 2 | "모두 펼치기/접기" 신호 | `userExpanded`를 신호 값으로 덮어쓰고, `userCollapsedDuringSearch`도
	//   |   |                        | 함께 재설정(전체 접기가 검색 자동 펼침을 이겨야 이름 그대로 동작) |
	//   | 3 (최하위, OR로만 기여) | 검색 자동 펼침 | 위 두 입력이 명시적으로 접지 않은 경우에만 열림에 기여 |
	//   검색어가 바뀌면 `userCollapsedDuringSearch`를 초기화해 새 검색어 기준으로 자동 펼침이 다시 적용된다.
	import { getContext } from 'svelte';
	import { Brain, ChevronDown, ChevronRight } from 'lucide-svelte';
	import type { ThinkingBlock } from '$lib/tools/transcript-viewer/types.js';
	import { SEARCH_CONTEXT_KEY } from '$lib/tools/transcript-viewer/search.js';
	import type { DetailSearchContext } from '../searchNav.js';
	import TextContent from './TextContent.svelte';

	let {
		block,
		lineIndex,
		expandSignal,
		expandValue
	}: {
		block: ThinkingBlock;
		/** 이 카드가 속한 메시지의 lineIndex. TextContent로 그대로 전달해 "현재 일치" 강조에 쓴다. */
		lineIndex?: number;
		expandSignal?: number;
		expandValue?: boolean;
	} = $props();

	const searchCtx = getContext<DetailSearchContext | undefined>(SEARCH_CONTEXT_KEY);
	const needle = $derived((searchCtx?.query ?? '').trim().toLowerCase());
	const searchActive = $derived(needle.length > 0);
	const hasMatch = $derived(searchActive && (block.thinking ?? '').toLowerCase().includes(needle));

	let userExpanded = $state(false);
	let userCollapsedDuringSearch = $state(false);
	let lastSignal = 0;
	let lastQuery = '';

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
</script>

<div class="rounded-xl border border-border bg-surface">
	<button
		type="button"
		class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/60 focus:outline-none focus:ring-2 focus:ring-ring/40"
		onclick={toggleExpanded}
	>
		{#if expanded}
			<ChevronDown class="size-3.5" aria-hidden="true" />
		{:else}
			<ChevronRight class="size-3.5" aria-hidden="true" />
		{/if}
		<Brain class="size-3.5" aria-hidden="true" />
		<span>사고 내용</span>
	</button>
	{#if expanded}
		<div class="border-t border-border px-4 py-3">
			<TextContent text={block.thinking} {lineIndex} />
		</div>
	{/if}
</div>
