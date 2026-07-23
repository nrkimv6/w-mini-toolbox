<script lang="ts">
	// Phase 3 (item 7, `_todo-2` 재타겟) — 세션 목록 카드 1개.
	// `SessionSummary`는 todo-1(transcript-viewer/sessionScanner.ts)이 소유하는 경량 요약
	// 타입이며, 이 컴포넌트는 전체 파싱(parseTranscript) 없이 요약 필드만 렌더한다.
	import { GitBranch, Layers } from 'lucide-svelte';
	import type { SessionSummary } from '$lib/tools/transcript-viewer/types.js';

	let { session }: { session: SessionSummary } = $props();

	const NO_INFO = '정보 없음';

	/** 제목 폴백 체인: aiTitle → lastPromptPreview → sessionId → path */
	const title = $derived(
		session.aiTitle ?? session.lastPromptPreview ?? session.sessionId ?? session.path
	);

	/** cwd 마지막 경로 세그먼트(프로젝트 폴더명) — posix/windows 구분자 모두 처리 */
	const projectFolder = $derived.by(() => {
		if (!session.cwd) return null;
		const parts = session.cwd.split(/[\\/]/).filter((p) => p.length > 0);
		return parts.length > 0 ? parts[parts.length - 1] : null;
	});

	/** ISO 타임스탬프를 "YYYY-MM-DD HH:mm"로 축약(로케일 비의존, raw 문자열 슬라이스) */
	function shortTimestamp(ts: string | undefined): string | null {
		if (!ts) return null;
		return ts.slice(0, 16).replace('T', ' ');
	}

	const timeRange = $derived.by(() => {
		const first = shortTimestamp(session.firstTimestamp);
		const last = shortTimestamp(session.lastTimestamp);
		if (!first && !last) return NO_INFO;
		if (first === last) return first ?? last ?? NO_INFO;
		return `${first ?? NO_INFO} ~ ${last ?? NO_INFO}`;
	});
</script>

<div class="flex flex-col gap-1.5 rounded-lg border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-secondary">
	<p class="truncate text-sm font-medium text-foreground" title={title}>{title}</p>
	<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-muted-foreground">
		<span>{timeRange}</span>
		{#if projectFolder}
			<span class="truncate">{projectFolder}</span>
		{/if}
		{#if session.gitBranch}
			<span class="inline-flex items-center gap-1 rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
				<GitBranch class="size-2.5" aria-hidden="true" />
				{session.gitBranch}
			</span>
		{/if}
		{#if session.subagentCount > 0}
			<span class="inline-flex items-center gap-1 rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
				<Layers class="size-2.5" aria-hidden="true" />
				{session.subagentCount}
			</span>
		{/if}
	</div>
</div>
