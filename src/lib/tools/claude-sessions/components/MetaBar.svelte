<script lang="ts">
	// Phase 3 (item 11) — 식별 메타 + 집계 (design prompt 72·73·74행)
	// 시각 근거: zip `SessionRow` 메타 라인(750~756) + 브랜치 배지(730~733) / `Stat` 4열 `<dl>`(375~419)
	//
	// Phase 4가 참조할 계약:
	//   - `meta`/`errors`는 parseTranscript(...) 결과를 그대로 내려주면 된다(가공 불필요)
	//   - `fileName`은 TranscriptMeta에 파일명 필드가 없어 File.name을 페이지에서 내려준다
	import { GitBranch } from 'lucide-svelte';
	import type { ParseError, TranscriptMeta } from '$lib/tools/transcript-viewer/types.js';

	let {
		meta,
		errors,
		fileName
	}: {
		meta: TranscriptMeta;
		errors: ParseError[];
		fileName: string;
	} = $props();

	const NO_INFO = '정보 없음';

	/** cwd 마지막 경로 세그먼트(프로젝트 폴더명) — posix/windows 구분자 모두 처리 */
	function lastPathSegment(path: string | undefined): string {
		if (!path) return NO_INFO;
		const normalized = path.replace(/\\/g, '/');
		const parts = normalized.split('/').filter((p) => p.length > 0);
		return parts.length > 0 ? parts[parts.length - 1] : NO_INFO;
	}

	const projectFolder = $derived(lastPathSegment(meta.cwd));
	const modelsLabel = $derived(meta.models.length > 0 ? meta.models.join(', ') : NO_INFO);
	const sessionIdLabel = $derived(meta.sessionId ?? NO_INFO);
	const branchLabel = $derived(meta.gitBranch ?? null);

	function fmtNumber(n: number): string {
		return n.toLocaleString();
	}

	const stats = $derived([
		{ label: '메시지', value: fmtNumber(meta.totalMessages) },
		{ label: '입력 토큰', value: fmtNumber(meta.totalInputTokens) },
		{ label: '출력 토큰', value: fmtNumber(meta.totalOutputTokens) },
		{ label: '캐시 생성', value: fmtNumber(meta.totalCacheCreationTokens) },
		{ label: '캐시 읽기', value: fmtNumber(meta.totalCacheReadTokens) }
	]);
</script>

<div class="rounded-xl border border-border bg-surface p-5">
	<!-- 식별 메타 라인: zip 750~756 (mono, flex-wrap) + 브랜치 배지 730~733 -->
	<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-muted-foreground">
		<span class="truncate" title={fileName}>{fileName}</span>
		<span>{sessionIdLabel}</span>
		<span>{projectFolder}</span>
		{#if branchLabel}
			<span class="inline-flex items-center gap-1 rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
				<GitBranch class="size-2.5" aria-hidden="true" />
				{branchLabel}
			</span>
		{/if}
		<span>{modelsLabel}</span>
	</div>

	<!-- 집계 통계: zip Stat 4열 `<dl>` 패턴(375~419), 항목 5개라 5열까지 확장 -->
	<dl class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
		{#each stats as stat (stat.label)}
			<div>
				<dt class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
					{stat.label}
				</dt>
				<dd class="mt-1 font-mono text-2xl text-foreground">{stat.value}</dd>
			</div>
		{/each}
	</dl>

	<!-- 파싱 실패 라인 수 (design prompt 74행) -->
	<p class="mt-4 text-[11px] font-mono text-muted-foreground">
		{#if errors.length === 0}
			파싱 실패 라인 없음
		{:else}
			파싱 실패 라인 {fmtNumber(errors.length)}건
		{/if}
	</p>
</div>
