<script lang="ts">
	// Phase 2 (item 6, `_todo-2` 재타겟) — 세션 시간 흐름. `buildSessionTimeline`(순수 함수,
	// timeline.ts)이 산출한 이벤트를 표시하고, 관련 메시지로 이동하는 콜백을 부모(+page.svelte)에
	// 위임한다(line index ↔ 메시지 DOM 위치 연결은 상세 화면 전체를 아는 페이지의 책임 —
	// AgentPanel.svelte의 onSelect와 동일한 위임 패턴).
	//
	// "시간 미확인 상태"(timestamp 없는 이벤트)는 `filterTimelineByRange`가 범위 필터 적용 시
	// 제외하므로(timeline.ts 계약), 범위가 활성화된 동안에는 별도 섹션으로 분리해 노출한다 —
	// 완전히 숨기면 "그 시간에 무슨 일이 있었는지 모른다"는 사실 자체가 사라지기 때문이다.
	import { AlertTriangle, Bot, MessageSquare, User, Wrench } from 'lucide-svelte';
	import { buildSessionTimeline, filterTimelineByRange, type TimelineEvent } from '$lib/tools/transcript-viewer/timeline.js';
	import type { RenderMessage } from '$lib/tools/transcript-viewer/types.js';

	let {
		messages,
		onNavigate,
		selectedLineIndex = null
	}: {
		messages: RenderMessage[];
		/** 이벤트의 원본 lineIndex로 상세 메시지 위치 이동 */
		onNavigate: (lineIndex: number) => void;
		/** 현재 강조할 이벤트의 lineIndex(선택) */
		selectedLineIndex?: number | null;
	} = $props();

	const allEvents = $derived(buildSessionTimeline(messages));

	let rangeFrom = $state('');
	let rangeTo = $state('');

	const rangeActive = $derived(rangeFrom.trim().length > 0 || rangeTo.trim().length > 0);

	const rangedEvents = $derived.by(() => {
		if (!rangeActive) return allEvents;
		return filterTimelineByRange(allEvents, {
			from: rangeFrom ? new Date(rangeFrom).toISOString() : undefined,
			to: rangeTo ? new Date(rangeTo).toISOString() : undefined
		});
	});

	/** 범위가 활성화된 동안에만 "시간 미확인이라 범위 판정에서 제외된 이벤트"를 별도로 보여준다 */
	const unknownTimeEvents = $derived(rangeActive ? allEvents.filter((e) => !e.timestamp) : []);

	function clearRange() {
		rangeFrom = '';
		rangeTo = '';
	}

	const EVENT_LABEL: Record<TimelineEvent['kind'], string> = {
		user: '사용자',
		assistant: '어시스턴트',
		tool: '도구 호출',
		'tool-error': '도구 오류',
		compact: '압축 이력'
	};

	function fmtTimestamp(ts: string | undefined): string {
		if (!ts) return '시간 미확인';
		const d = new Date(ts);
		if (Number.isNaN(d.getTime())) return ts;
		return d.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	/** 첫 이벤트(시간 확인 가능한 것 기준) 대비 경과 시간 */
	const firstKnownTimestamp = $derived.by(() => {
		for (const e of allEvents) if (e.timestamp) return e.timestamp;
		return undefined;
	});

	function elapsedLabel(ts: string | undefined): string {
		if (!ts || !firstKnownTimestamp) return '—';
		const deltaMs = Date.parse(ts) - Date.parse(firstKnownTimestamp);
		if (!Number.isFinite(deltaMs) || deltaMs < 0) return '—';
		const totalSeconds = Math.round(deltaMs / 1000);
		if (totalSeconds < 60) return `+${totalSeconds}초`;
		const totalMinutes = Math.round(totalSeconds / 60);
		if (totalMinutes < 60) return `+${totalMinutes}분`;
		return `+${Math.floor(totalMinutes / 60)}시간 ${totalMinutes % 60}분`;
	}
</script>

{#snippet eventIcon(kind: TimelineEvent['kind'])}
	{#if kind === 'user'}
		<User class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
	{:else if kind === 'assistant'}
		<Bot class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
	{:else if kind === 'tool'}
		<Wrench class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
	{:else if kind === 'tool-error'}
		<AlertTriangle class="size-3.5 shrink-0 text-destructive" aria-hidden="true" />
	{:else}
		<MessageSquare class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
	{/if}
{/snippet}

{#snippet eventRow(event: TimelineEvent)}
	<li>
		<button
			type="button"
			onclick={() => onNavigate(event.lineIndex)}
			class="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 {selectedLineIndex ===
			event.lineIndex
				? 'border-ring bg-secondary/40'
				: 'border-border bg-background hover:bg-secondary/20'}"
		>
			{@render eventIcon(event.kind)}
			<span class="w-20 shrink-0 font-medium text-foreground">{EVENT_LABEL[event.kind]}</span>
			{#if event.toolName}
				<span class="w-32 shrink-0 truncate font-mono text-[11px] text-muted-foreground">{event.toolName}</span>
			{/if}
			<span class="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">{elapsedLabel(event.timestamp)}</span>
			<span class="w-40 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{fmtTimestamp(event.timestamp)}</span>
		</button>
	</li>
{/snippet}

<div class="rounded-xl border border-border bg-surface p-5">
	<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
		<div>
			<p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">시간 흐름</p>
			<h3 class="mt-1 text-lg font-semibold tracking-tight">{rangedEvents.length}개 활동</h3>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<label class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
				시작
				<input
					type="datetime-local"
					bind:value={rangeFrom}
					class="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
				/>
			</label>
			<label class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
				종료
				<input
					type="datetime-local"
					bind:value={rangeTo}
					class="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
				/>
			</label>
			{#if rangeActive}
				<button
					type="button"
					onclick={clearRange}
					class="text-[11px] font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
				>
					범위 해제
				</button>
			{/if}
		</div>
	</div>

	{#if allEvents.length === 0}
		<p class="rounded-md border border-dashed border-border bg-background px-4 py-6 text-center text-xs text-muted-foreground">
			표시할 활동이 없습니다.
		</p>
	{:else if rangedEvents.length === 0}
		<p class="rounded-md border border-dashed border-border bg-background px-4 py-6 text-center text-xs text-muted-foreground">
			선택한 범위에 활동이 없습니다.
		</p>
	{:else}
		<ul class="flex flex-col gap-1.5">
			{#each rangedEvents as event, index (`${event.lineIndex}-${event.kind}-${index}`)}
				{@render eventRow(event)}
			{/each}
		</ul>
	{/if}

	{#if unknownTimeEvents.length > 0}
		<div class="mt-4 border-t border-dashed border-border pt-3">
			<p class="mb-2 text-[11px] text-muted-foreground">
				시간 정보가 없어 범위 판정에서 제외된 활동 {unknownTimeEvents.length}건 — 아래에서 계속 확인할 수 있습니다.
			</p>
			<ul class="flex flex-col gap-1.5">
				{#each unknownTimeEvents as event, index (`unknown-${event.lineIndex}-${event.kind}-${index}`)}
					{@render eventRow(event)}
				{/each}
			</ul>
		</div>
	{/if}
</div>
