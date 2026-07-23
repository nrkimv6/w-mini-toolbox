<script lang="ts">
	// Phase 3 (item 12) — 4종 토글 상태 + 표시/전체 카운트 + 전체 해제 (design prompt 75·76·78행)
	// 시각 근거: 상태 체크박스 라벨(zip 551~568, hover:bg-secondary/60) + 카운트 헤더(zip 590~595, FilterRow 680)
	//            + "Clear all filters" 링크 버튼(zip 572~580)
	//
	// Phase 4가 참조할 계약:
	//   - 4개 토글은 개별 $bindable prop이다: `bind:showMessages` `bind:showToolCalls`
	//     `bind:showThinking` `bind:showCompactHistory` — 페이지가 $state로 소유하고
	//     FilterControls와 MessageBlock(필터 파이프라인) 양쪽에 동일한 값을 내려준다.
	//   - `visibleCount`/`totalCount`는 페이지가 필터링 결과로 계산해 내려준다(76행).
	//   - 78행 "조건 전체 해제" 버튼은 이 컴포넌트가 자체 상태를 리셋한다($bindable이라 부모에도 반영됨).
	//     MessageBlock의 78행 빈 상태(EmptyList)에 필요한 "해제" 액션은 페이지가 별도로
	//     동일한 4개 $state를 리셋하는 `onClearAll` 콜백을 만들어 MessageBlock에 내려준다
	//     (FilterControls의 clearAll()과 동일한 리셋 로직을 페이지 쪽에도 둔다).
	import { RotateCcw } from 'lucide-svelte';

	let {
		showMessages = $bindable(true),
		showToolCalls = $bindable(true),
		showThinking = $bindable(true),
		showCompactHistory = $bindable(true),
		visibleCount,
		totalCount
	}: {
		showMessages?: boolean;
		showToolCalls?: boolean;
		showThinking?: boolean;
		showCompactHistory?: boolean;
		visibleCount: number;
		totalCount: number;
	} = $props();

	const anyOff = $derived(!showMessages || !showToolCalls || !showThinking || !showCompactHistory);

	function clearAll() {
		showMessages = true;
		showToolCalls = true;
		showThinking = true;
		showCompactHistory = true;
	}
</script>

<div class="rounded-xl border border-border bg-surface p-5">
	<!-- 표시 중 / 전체 카운트 (design prompt 76행) — zip "{filtered.length} of {total}" 590~595 -->
	<p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">메시지 필터</p>
	<h3 class="mt-1 text-lg font-semibold tracking-tight">
		{visibleCount}
		<span class="text-muted-foreground">/ {totalCount}</span>
	</h3>

	<!-- 4종 토글 (design prompt 75행) — zip 상태 체크박스 라벨 551~568 -->
	<div class="mt-4 space-y-1">
		<label class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary/60">
			<input
				type="checkbox"
				bind:checked={showMessages}
				class="rounded border-border focus:outline-none focus:ring-2 focus:ring-ring/40"
			/>
			역할별 메시지
		</label>
		<label class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary/60">
			<input
				type="checkbox"
				bind:checked={showToolCalls}
				class="rounded border-border focus:outline-none focus:ring-2 focus:ring-ring/40"
			/>
			도구 호출
		</label>
		<label class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary/60">
			<input
				type="checkbox"
				bind:checked={showThinking}
				class="rounded border-border focus:outline-none focus:ring-2 focus:ring-ring/40"
			/>
			사고 내용
		</label>
		<label class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary/60">
			<input
				type="checkbox"
				bind:checked={showCompactHistory}
				class="rounded border-border focus:outline-none focus:ring-2 focus:ring-ring/40"
			/>
			압축 이력
		</label>
	</div>

	<!-- 조건 전체 해제 (design prompt 78행) — zip "Clear all filters" 572~580 -->
	{#if anyOff}
		<button
			type="button"
			onclick={clearAll}
			class="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
		>
			<RotateCcw class="size-3" aria-hidden="true" />
			필터 초기화
		</button>
	{/if}
</div>
