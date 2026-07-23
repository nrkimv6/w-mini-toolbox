<script lang="ts">
	// Phase 3 (item 8, `_todo-2` 재타겟) — 세션 목록 컨테이너.
	// 카드 정렬(lastTimestamp 내림차순) + 로딩/빈 목록 상태를 소유하고, 카드 클릭 시
	// `onselect(s.path)`를 호출해 상위(+page.svelte)로 선택된 세션의 경로만 전달한다.
	import type { SessionSummary } from '$lib/tools/transcript-viewer/types.js';
	import SessionListItem from './SessionListItem.svelte';

	let {
		sessions,
		loading = false,
		onselect
	}: {
		sessions: SessionSummary[];
		loading?: boolean;
		onselect: (path: string) => void;
	} = $props();

	const sorted = $derived(
		[...sessions].sort((a, b) => (b.lastTimestamp ?? '').localeCompare(a.lastTimestamp ?? ''))
	);
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
	<div class="flex flex-col gap-2">
		{#each sorted as s (s.path)}
			<button type="button" class="text-left" onclick={() => onselect(s.path)}>
				<SessionListItem session={s} />
			</button>
		{/each}
	</div>
{/if}
