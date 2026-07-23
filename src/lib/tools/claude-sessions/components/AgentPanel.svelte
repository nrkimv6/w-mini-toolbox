<script lang="ts">
	// Phase 3 (item 8~10) — 서브에이전트 패널 (design prompt 162~168행, roadmap 항목 2)
	// 시각 근거: zip 서브에이전트 배지(735~739) + 카드 컨테이너 `rounded-xl border border-border
	// bg-surface` + 메타 라인 `flex flex-wrap gap-x-4 text-[11px] font-mono text-muted-foreground`(750~756)
	//
	// 값 없음 표기 규칙(이 계획서 고유 — 복사 계획서의 "값 없으면 숨김" 규칙과 다르다):
	//   - `undefined`(원본에 값 자체가 없음) -> "정보 없음"
	//   - `null`(구조적으로 확인 불가 — 형제 파일 필요) -> "확인 불가"
	// 항목을 숨기지 않는다(168행) — 마지막 활동/활동 시간/메시지 수/도구 호출 수/오류 수는 값이
	// 없어도 항목명과 함께 항상 렌더한다.
	import { Bot } from 'lucide-svelte';
	import type { AgentRun } from '$lib/tools/claude-sessions/agentRuns.js';

	let {
		runs,
		selectedAgentId = null,
		onSelect
	}: {
		runs: AgentRun[];
		selectedAgentId?: string | null;
		/** 카드 선택 콜백. 첫 활동 위치 이동/범위 좁히기는 페이지(+page.svelte, Phase 4)가 소유한다 */
		onSelect: (agentId: string) => void;
	} = $props();

	const NO_INFO = '정보 없음';
	const UNAVAILABLE = '확인 불가';

	function fmtTimestamp(ts: string | undefined): string {
		if (!ts) return NO_INFO;
		const d = new Date(ts);
		if (Number.isNaN(d.getTime())) return ts;
		return d.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
	}

	const badgeClass =
		'rounded-sm bg-secondary px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground';
</script>

<div class="rounded-xl border border-border bg-surface p-5">
	<div class="mb-4 flex items-center justify-between">
		<div>
			<p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">서브에이전트</p>
			<h3 class="mt-1 text-lg font-semibold tracking-tight">{runs.length}개</h3>
		</div>
	</div>

	{#if runs.length === 0}
		<!-- item 10 — 0건 상태. 오류(destructive) 표현을 쓰지 않는다 -->
		<p class="rounded-md border border-dashed border-border bg-background px-4 py-6 text-center text-xs text-muted-foreground">
			이 세션에는 서브에이전트 실행이 없습니다.
		</p>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each runs as run (run.agentId)}
				{@const selected = selectedAgentId === run.agentId}
				<li>
					<!-- item 16 — 선택 가능한 카드는 button 시맨틱을 갖는다(div+click 금지) -->
					<button
						type="button"
						onclick={() => onSelect(run.agentId)}
						aria-pressed={selected}
						class="w-full rounded-xl border p-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 {selected
							? 'border-ring bg-secondary/40'
							: 'border-border bg-background hover:bg-secondary/20'}"
					>
						<div class="mb-1.5 flex flex-wrap items-center gap-2">
							<Bot class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
							<span class="font-mono text-[11px] font-semibold text-foreground">
								{run.identifierConfirmed ? run.agentId : `${UNAVAILABLE} (${run.agentId})`}
							</span>
							{#if run.status}
								<span class={badgeClass}>{run.status}</span>
							{/if}
							{#if run.model}
								<span class={badgeClass}>{run.model}</span>
							{/if}
						</div>

						{#if run.description}
							<p class="mb-1.5 text-xs text-foreground">{run.description}</p>
						{:else}
							<p class="mb-1.5 text-xs italic text-muted-foreground">{NO_INFO}</p>
						{/if}

						<!-- 메타 라인: 확인 가능 항목(163·164행) -->
						<div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-muted-foreground">
							<span>시작 {fmtTimestamp(run.launchTimestamp)}</span>
							<span>모델 {run.model ?? NO_INFO}</span>
							<span>상태 {run.status ?? NO_INFO}</span>
						</div>

						<!-- 누락 상태 안내(item 9, 167·168행) — 항목을 숨기지 않고 항목명과 함께 표시한다 -->
						<div class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-muted-foreground/70">
							<span>마지막 활동 {run.lastActivityTimestamp == null ? UNAVAILABLE : fmtTimestamp(run.lastActivityTimestamp)}</span>
							<span>활동 시간 {UNAVAILABLE}</span>
							<span>메시지 수 {run.inlineMessageCount == null ? UNAVAILABLE : `${run.inlineMessageCount}건`}</span>
							<span>도구 호출 수 {UNAVAILABLE}</span>
							<span>오류 수 {UNAVAILABLE}</span>
						</div>
					</button>
				</li>
			{/each}
		</ul>

		<!-- 사유 안내(item 9) — 패널 하단에 1회만 노출 -->
		<p class="mt-4 text-[11px] text-muted-foreground">
			서브에이전트 대화는 별도 파일에 저장되어 이 화면에서는 확인할 수 없습니다. 위 "확인 불가" 항목은
			그 형제 파일을 열어야 채울 수 있습니다.
		</p>
	{/if}
</div>
