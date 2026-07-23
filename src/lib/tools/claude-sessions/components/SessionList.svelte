<script lang="ts">
	// Phase 3 (item 8, `_todo-2` 재타겟) — 세션 목록 컨테이너.
	// `_todo-2` Phase 2 — inline 정렬을 `sortSessions`(카탈로그 순수 함수)로 대체한다.
	// 검색어 필터링(`querySessions`)은 +page.svelte가 소유하고, 이 컴포넌트는 이미 필터된
	// `sessions`를 받아 정렬만 적용한다. 기본 정렬(`sortKey='lastActivity', sortDir='desc'`)은
	// 기존 inline `lastTimestamp` 내림차순 동작과 동일하다(fallback으로 firstTimestamp를 쓰는
	// 점만 sortSessions가 더 정교하다).
	//
	// Phase 2 (방향키/Enter/focus 계약) — roving tabindex: 목록 안에서는 항상 정확히 1개
	// 항목만 tabindex=0이고(현재 포커스 대상 또는 첫 항목), 나머지는 -1이다. 방향키로 그
	// 대상을 옮기고 Enter로 상세 진입한다. `focusedPath`는 $bindable이라 +page.svelte가
	// 목록→상세→목록 왕복 시 마지막 포커스 대상을 복원할 수 있다(탐색 상태 복원, Phase 3).
	import { tick } from 'svelte';
	import type { SessionSortKey, SessionSummary, SortDirection } from '$lib/tools/transcript-viewer/types.js';
	import { sortSessions } from '$lib/tools/transcript-viewer/sessionCatalog.js';
	import SessionListItem from './SessionListItem.svelte';

	let {
		sessions,
		loading = false,
		sortKey = 'lastActivity',
		sortDir = 'desc',
		focusedPath = $bindable<string | null>(null),
		onselect
	}: {
		sessions: SessionSummary[];
		loading?: boolean;
		sortKey?: SessionSortKey;
		sortDir?: SortDirection;
		/** 현재 키보드 포커스 대상 경로. 목록→상세→목록 왕복 시 복원용으로 부모가 바인딩한다 */
		focusedPath?: string | null;
		onselect: (path: string) => void;
	} = $props();

	const sorted = $derived(sortSessions(sessions, sortKey, sortDir));

	let itemEls: Record<string, HTMLButtonElement> = {};

	function indexOfFocused(): number {
		if (!focusedPath) return -1;
		return sorted.findIndex((s) => s.path === focusedPath);
	}

	function moveFocus(delta: number) {
		if (sorted.length === 0) return;
		const current = indexOfFocused();
		const next =
			current < 0 ? (delta > 0 ? 0 : sorted.length - 1) : Math.max(0, Math.min(sorted.length - 1, current + delta));
		focusedPath = sorted[next].path;
		tick().then(() => itemEls[sorted[next].path]?.focus());
	}

	function handleKeydown(e: KeyboardEvent, path: string) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			moveFocus(1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			moveFocus(-1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			focusedPath = path;
			onselect(path);
		}
	}
</script>

{#if loading}
	<div
		role="status"
		aria-live="polite"
		class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center text-sm text-muted-foreground"
	>
		<span>세션 목록을 읽는 중입니다…</span>
	</div>
{:else if sessions.length === 0}
	<div
		role="status"
		aria-live="polite"
		class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center text-sm text-muted-foreground"
	>
		<span>표시할 세션이 없습니다.</span>
	</div>
{:else}
	<div class="flex flex-col gap-2" role="listbox" aria-label="세션 목록">
		{#each sorted as s, index (s.path)}
			<button
				type="button"
				bind:this={itemEls[s.path]}
				class="rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
				role="option"
				aria-selected={s.path === focusedPath}
				tabindex={s.path === focusedPath || (focusedPath == null && index === 0) ? 0 : -1}
				onclick={() => {
					focusedPath = s.path;
					onselect(s.path);
				}}
				onkeydown={(e) => handleKeydown(e, s.path)}
			>
				<SessionListItem session={s} />
			</button>
		{/each}
	</div>
{/if}
