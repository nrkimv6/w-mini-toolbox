<script lang="ts">
	// Phase 5 (item 15, 조건부) — inline sidechain 연속 런 그룹 카드 (구버전 세션 대응)
	// 시각 근거: zip `<details>` 접힘 카드(612~626). 기본 접힘 + 포함 메시지 수 표기.
	//
	// Phase 1 항목 4 결정: `groupSidechainRuns` 재사용을 "유지"로 확정했다. 현재 세션
	// 스키마에서는 이 그룹이 **0건인 것이 정상**이다(inline isSidechain 라인 자체가
	// 실사에서 관측되지 않음 — Phase 1 항목 1·2 참조). 이 컴포넌트는 구버전 세션이
	// 열렸을 때만 실제로 렌더된다.
	import type { RenderMessage } from '$lib/tools/transcript-viewer/types.js';
	import MessageBlock from './MessageBlock.svelte';

	let {
		messages,
		showToolCalls = true,
		showThinking = true,
		expandSignal,
		expandValue,
		highlightedLineIndex = null,
		onSelectAgent
	}: {
		messages: RenderMessage[];
		showToolCalls?: boolean;
		showThinking?: boolean;
		expandSignal?: number;
		expandValue?: boolean;
		highlightedLineIndex?: number | null;
		/** item 15 두 번째 항목 — 카드 헤더에서 해당 에이전트를 선택할 수 있게 연결(11번 선택 상태 재사용) */
		onSelectAgent?: (agentId: string) => void;
	} = $props();

	const groupAgentId = $derived.by(() => {
		for (const m of messages) {
			const id = m.raw?.agentId;
			if (typeof id === 'string') return id;
		}
		return null;
	});
</script>

<details class="rounded-xl border border-border bg-surface p-4" open={false}>
	<summary class="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-foreground">
		<span>서브에이전트 연속 활동 — {messages.length}개 메시지</span>
		{#if groupAgentId && onSelectAgent}
			<button
				type="button"
				onclick={(e) => {
					e.preventDefault();
					onSelectAgent?.(groupAgentId as string);
				}}
				class="rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40"
			>
				이 에이전트 선택
			</button>
		{/if}
	</summary>
	<div class="mt-3 flex flex-col gap-3">
		{#each messages as message (message.lineIndex)}
			<MessageBlock
				{message}
				{showToolCalls}
				{showThinking}
				{expandSignal}
				{expandValue}
				highlighted={highlightedLineIndex === message.lineIndex}
			/>
		{/each}
	</div>
</details>
