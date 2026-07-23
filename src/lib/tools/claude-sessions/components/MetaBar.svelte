<script lang="ts">
	// Phase 3 (item 11) — 식별 메타 + 집계 (design prompt 72·73·74행)
	// Phase 3·4 (copy-session-info 계획서) — 세션 정보 복사 (design prompt 171~174행)
	// 시각 근거: zip `SessionRow` 메타 라인(750~756) + 브랜치 배지(730~733) / `Stat` 4열 `<dl>`(375~419)
	//   + 아이콘 버튼 위계(366~372)
	//
	// Phase 4가 참조할 계약:
	//   - `meta`/`errors`는 parseTranscript(...) 결과를 그대로 내려주면 된다(가공 불필요)
	//   - `fileName`은 TranscriptMeta에 파일명 필드가 없어 File.name을 페이지에서 내려준다
	import { onDestroy } from 'svelte';
	import { GitBranch, Copy, Files } from 'lucide-svelte';
	import type { ParseError, TranscriptMeta } from '$lib/tools/transcript-viewer/types.js';
	import { buildCopyTargets, buildCopyAllText } from '$lib/tools/claude-sessions/copyTargets.js';
	import { copyText } from '$lib/tools/claude-sessions/clipboard.js';

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

	// 복사 대상 (design prompt 171·174행) — 값이 없는 항목은 buildCopyTargets가 제외한다
	const copyTargets = $derived(buildCopyTargets({ fileName, meta }));
	const copyAllText = $derived(buildCopyAllText(copyTargets));

	/** 복사 결과 알림 — 대상 라벨과 결과를 함께 담는다 (173행, 결과만 표시하면 미충족) */
	let copyStatus = $state<{ label: string; ok: boolean; reason?: 'unsupported' | 'denied' | 'failed' } | null>(
		null
	);

	// 연속 복사 시 알림을 교체(스택 누적 금지)하고, 늦게 도착한 이전 요청의 결과가
	// 이후 시작된 최신 요청의 결과를 덮지 않도록 요청 순번을 비교한다.
	let requestSeq = 0;
	let dismissTimer: ReturnType<typeof setTimeout> | undefined;

	const FAILURE_MESSAGE: Record<'unsupported' | 'denied' | 'failed', string> = {
		unsupported: '이 브라우저는 클립보드 복사를 지원하지 않습니다.',
		denied: '클립보드 권한이 거부되었습니다.',
		failed: '알 수 없는 이유로 복사에 실패했습니다.'
	};

	function clearDismissTimer() {
		if (dismissTimer !== undefined) {
			clearTimeout(dismissTimer);
			dismissTimer = undefined;
		}
	}

	function scheduleDismiss(seq: number) {
		clearDismissTimer();
		dismissTimer = setTimeout(() => {
			if (requestSeq === seq) copyStatus = null;
		}, 2000);
	}

	async function handleCopy(label: string, value: string) {
		const seq = ++requestSeq;
		const result = await copyText(value);
		// late-writer ordering: 응답을 받은 시점에 더 최신 요청이 이미 시작됐다면 이 결과는 버린다
		if (seq !== requestSeq) return;
		clearDismissTimer();
		if (result.ok) {
			copyStatus = { label, ok: true };
			scheduleDismiss(seq);
		} else {
			copyStatus = { label, ok: false, reason: result.reason };
		}
	}

	onDestroy(clearDismissTimer);
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

	<!-- 세션 정보 복사 (design prompt 171·172·174행) — 값 없는 항목은 버튼 자체를 렌더하지 않는다 -->
	{#if copyTargets.length > 0}
		<div class="mt-3 flex flex-wrap items-center gap-1.5">
			{#each copyTargets as target (target.key)}
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
					aria-label="{target.label} 복사"
					onclick={() => handleCopy(target.label, target.value)}
				>
					<Copy class="size-2.5" aria-hidden="true" />
					{target.label}
				</button>
			{/each}
			<button
				type="button"
				class="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
				aria-label="전체 복사"
				onclick={() => handleCopy('전체', copyAllText)}
			>
				<Files class="size-2.5" aria-hidden="true" />
				전체 복사
			</button>
		</div>
	{/if}

	<!-- 복사 결과 알림 (173행) -->
	{#if copyStatus}
		<p
			role="status"
			aria-live="polite"
			class="mt-2 text-[11px] {copyStatus.ok ? 'text-muted-foreground' : 'text-destructive'}"
		>
			{#if copyStatus.ok}
				{copyStatus.label} 복사됨
			{:else}
				{copyStatus.label} 복사 실패 — {FAILURE_MESSAGE[copyStatus.reason ?? 'failed']} 직접 선택해 복사해 주세요.
			{/if}
		</p>
	{/if}

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
