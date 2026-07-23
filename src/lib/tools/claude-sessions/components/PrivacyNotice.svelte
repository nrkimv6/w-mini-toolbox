<script lang="ts">
	// Phase 2 — 로컬 처리·읽기 전용 안내 pill. `_todo-1` 계획서 항목 29가 확정한 형태 그대로 이식했다
	// (소스 `PrivacyNotice.tsx` — 화면 하단 고정 pill, 좌측 상태 도트 + 우측 텍스트).
	// props/이벤트 없음 — 순수 정적 컴포넌트.
	// 배치 계약(Phase 4 소유): 이 컴포넌트는 `view` 상태(entry/detail/오류 등) 분기 **밖**,
	// 페이지 최상위 wrapper에 정확히 1곳만 렌더해야 한다. 그래야 모든 상태에서 동일하게 노출되면서도
	// 화면마다 중복 렌더되지 않는다(design prompt 12~13행 "모든 상태에서 보인다" 요구를 이 배치로 충족).
	// EntryAside.svelte와 카피가 겹치지 않는다 — `_todo-1` 항목 25 참조.
</script>

<div class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
	<div
		role="status"
		aria-live="polite"
		class="flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-[11px] font-medium tracking-wide text-primary-foreground shadow-lg ring-1 ring-black/10"
	>
		<span class="size-1.5 rounded-full bg-success" aria-hidden="true"></span>
		<span class="uppercase tracking-wider opacity-90">브라우저 안에서만 처리 · 읽기 전용</span>
	</div>
</div>
