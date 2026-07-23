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
	import { Brain, ChevronDown, ChevronRight } from 'lucide-svelte';
	import type { ThinkingBlock } from '$lib/tools/transcript-viewer/types.js';
	import TextContent from './TextContent.svelte';

	let {
		block,
		expandSignal,
		expandValue
	}: {
		block: ThinkingBlock;
		expandSignal?: number;
		expandValue?: boolean;
	} = $props();

	let expanded = $state(false);
	let lastSignal = 0;

	$effect(() => {
		if (expandSignal !== undefined && expandSignal !== lastSignal) {
			lastSignal = expandSignal;
			expanded = expandValue ?? expanded;
		}
	});
</script>

<div class="rounded-xl border border-border bg-surface">
	<button
		type="button"
		class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/60 focus:outline-none focus:ring-2 focus:ring-ring/40"
		onclick={() => (expanded = !expanded)}
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
			<TextContent text={block.thinking} />
		</div>
	{/if}
</div>
