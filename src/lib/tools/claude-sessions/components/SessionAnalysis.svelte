<script lang="ts">
	// Phase 2 (item 5, `_todo-2` 재타겟) — 세션 비교와 프로젝트 집계 화면.
	// 이 컴포넌트는 카탈로그 검색/정렬(+page.svelte 소유) 상태를 건드리지 않고, 자체 비교
	// 대상 선택(내부 state)과 자체 날짜·모델 조건(프로젝트 집계 전용)만 소유한다 — SessionList의
	// favoritesOnly와 동일하게 "부모 상태 위에 얹는 별도 축" 패턴을 따른다.
	//
	// 입력 `sessions`는 sessionAnalytics.ts의 `SessionAnalyticsInput`(SessionSummary + 선택적
	// `meta`)이다. `meta`는 오직 목록에서 이미 열어본(=상세로 진입해 parseTranscript가 실행된)
	// 세션에만 채워진다(+page.svelte의 sessionMetaCache) — 아직 열어보지 않은 세션은 누락값으로
	// 표시하고 "상세로 이동" 버튼으로 열람을 유도한다(누락값을 자유텍스트로 추측하지 않는다).
	import { ArrowRight, Folder, X } from 'lucide-svelte';
	import {
		compareSessionMetrics,
		aggregateSessionsByProject,
		DEFAULT_METRIC_KEYS,
		type AnalyticsMetricKey,
		type SessionAnalyticsInput
	} from '$lib/tools/transcript-viewer/sessionAnalytics.js';

	let {
		sessions,
		onOpenSession,
		onOpenProject
	}: {
		sessions: SessionAnalyticsInput[];
		/** 비교 대상 세션 1건을 상세로 이동한다(catalog에 있는 세션만 — fileHandle 없는 세션은 무시) */
		onOpenSession: (path: string) => void;
		/** 프로젝트(cwd) 집계 행의 세션들로 목록 검색을 좁힌다 */
		onOpenProject: (project: string) => void;
	} = $props();

	/** 한 번에 비교할 수 있는 세션 수 상한 — 표가 가로로 무한히 늘어나는 것을 막는다 */
	const MAX_COMPARE = 6;

	const METRIC_LABELS: Record<AnalyticsMetricKey, string> = {
		totalMessages: '총 메시지 수',
		totalInputTokens: '입력 토큰',
		totalOutputTokens: '출력 토큰',
		totalCacheTokens: '캐시 토큰',
		durationMs: '진행 시간',
		subagentCount: '서브에이전트 수'
	};

	let selectedPaths = $state<string[]>([]);
	let pickerQuery = $state('');

	const selectedSet = $derived(new Set(selectedPaths));
	const atLimit = $derived(selectedPaths.length >= MAX_COMPARE);

	const pickerCandidates = $derived.by(() => {
		const text = pickerQuery.trim().toLowerCase();
		return sessions
			.filter((s) => !selectedSet.has(s.path))
			.filter((s) => {
				if (!text) return true;
				const fields = [s.aiTitle, s.cwd, s.gitBranch, s.sessionId, s.path];
				return fields.some((f) => typeof f === 'string' && f.toLowerCase().includes(text));
			})
			.slice(0, 20);
	});

	function addToCompare(path: string) {
		if (atLimit || selectedSet.has(path)) return;
		selectedPaths = [...selectedPaths, path];
	}

	function removeFromCompare(path: string) {
		selectedPaths = selectedPaths.filter((p) => p !== path);
	}

	function clearCompare() {
		selectedPaths = [];
	}

	const selectedSessions = $derived(
		selectedPaths.map((p) => sessions.find((s) => s.path === p)).filter((s): s is SessionAnalyticsInput => !!s)
	);

	const comparisons = $derived(
		selectedSessions.length >= 2 ? compareSessionMetrics(selectedSessions, DEFAULT_METRIC_KEYS) : []
	);

	function sessionLabel(session: SessionAnalyticsInput): string {
		return session.aiTitle ?? session.lastPromptPreview ?? session.sessionId ?? session.path;
	}

	function fmtValue(metric: AnalyticsMetricKey, value: number | null): string {
		if (value === null) return '누락값';
		if (metric === 'durationMs') {
			const totalMinutes = Math.round(value / 60000);
			if (totalMinutes < 60) return `${totalMinutes}분`;
			return `${Math.floor(totalMinutes / 60)}시간 ${totalMinutes % 60}분`;
		}
		return value.toLocaleString();
	}

	// 프로젝트 집계 — 날짜/모델 조건은 이 섹션 전용(비교 섹션의 selectedPaths와 별도 축)
	let dateFrom = $state('');
	let dateTo = $state('');
	let modelFilterText = $state('');

	const allModels = $derived.by(() => {
		const set = new Set<string>();
		for (const s of sessions) for (const m of s.meta?.models ?? []) set.add(m);
		return Array.from(set).sort();
	});

	const aggregateOptions = $derived({
		dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
		dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
		models: modelFilterText.trim() ? [modelFilterText.trim()] : undefined
	});

	const projectAggregates = $derived(aggregateSessionsByProject(sessions, aggregateOptions));

	function fmtTimestamp(ts: string | undefined): string {
		if (!ts) return '정보 없음';
		const d = new Date(ts);
		if (Number.isNaN(d.getTime())) return ts;
		return d.toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
	}

	function clearAggregateFilters() {
		dateFrom = '';
		dateTo = '';
		modelFilterText = '';
	}
</script>

<div class="flex flex-col gap-6">
	<!-- 비교 대상 선택 -->
	<section class="rounded-xl border border-border bg-surface p-5">
		<div class="mb-4 flex items-center justify-between gap-2">
			<div>
				<p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">세션 비교</p>
				<h3 class="mt-1 text-lg font-semibold tracking-tight">
					{selectedPaths.length}
					<span class="text-muted-foreground">/ {MAX_COMPARE}</span>
				</h3>
			</div>
			{#if selectedPaths.length > 0}
				<button
					type="button"
					onclick={clearCompare}
					class="text-[11px] font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
				>
					선택 해제
				</button>
			{/if}
		</div>

		{#if selectedPaths.length > 0}
			<ul class="mb-4 flex flex-wrap gap-1.5">
				{#each selectedSessions as session (session.path)}
					<li class="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground">
						<span class="max-w-[14rem] truncate">{sessionLabel(session)}</span>
						<button
							type="button"
							onclick={() => removeFromCompare(session.path)}
							aria-label={`${sessionLabel(session)} 비교 대상에서 제거`}
							class="text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
						>
							<X class="size-3" aria-hidden="true" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<!-- 선택 제한 안내 -->
		{#if atLimit}
			<p class="mb-2 text-[11px] text-warning-foreground">
				최대 {MAX_COMPARE}개까지 비교할 수 있습니다. 더 추가하려면 먼저 하나를 제거하세요.
			</p>
		{/if}

		<div class="relative">
			<input
				type="text"
				bind:value={pickerQuery}
				disabled={atLimit}
				aria-label="비교 대상 세션 검색"
				placeholder={atLimit ? '선택 제한에 도달했습니다' : '제목, 프로젝트, 브랜치, 세션 ID로 검색해 추가…'}
				class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
			/>
		</div>

		{#if !atLimit && pickerQuery.trim().length > 0}
			<ul class="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-border bg-background p-1">
				{#if pickerCandidates.length === 0}
					<li class="px-2 py-2 text-center text-[11px] text-muted-foreground">일치하는 세션이 없습니다.</li>
				{:else}
					{#each pickerCandidates as session (session.path)}
						<li>
							<button
								type="button"
								onclick={() => addToCompare(session.path)}
								class="w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40"
							>
								<span class="block truncate">{sessionLabel(session)}</span>
								<span class="block truncate text-[10px] text-muted-foreground">{session.cwd ?? '정보 없음'}</span>
							</button>
						</li>
					{/each}
				{/if}
			</ul>
		{/if}

		{#if selectedPaths.length === 1}
			<p class="mt-3 text-[11px] text-muted-foreground">비교하려면 세션을 1개 더 추가하세요.</p>
		{:else if comparisons.length > 0}
			<div class="mt-4 overflow-x-auto">
				<table class="w-full min-w-[32rem] border-collapse text-xs">
					<thead>
						<tr class="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
							<th class="py-1.5 pr-3 font-medium">지표</th>
							{#each selectedSessions as session (session.path)}
								<th class="py-1.5 pr-3 font-medium">
									<button
										type="button"
										onclick={() => onOpenSession(session.path)}
										class="inline-flex items-center gap-1 text-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-ring/40"
									>
										<span class="max-w-[10rem] truncate">{sessionLabel(session)}</span>
										<ArrowRight class="size-3 shrink-0" aria-hidden="true" />
									</button>
								</th>
							{/each}
							<th class="py-1.5 pr-3 font-medium">차이(최대-최소)</th>
						</tr>
					</thead>
					<tbody>
						{#each comparisons as row (row.metric)}
							<tr class="border-b border-border/60">
								<td class="py-1.5 pr-3 font-medium text-foreground">{METRIC_LABELS[row.metric]}</td>
								{#each row.values as v (v.path)}
									<td
										class="py-1.5 pr-3 font-mono {v.value !== null && row.min && v.value === row.min.value
											? 'text-success-foreground'
											: ''} {v.value !== null && row.max && v.value === row.max.value && row.min?.value !== row.max?.value
											? 'font-semibold text-primary'
											: ''}"
									>
										{fmtValue(row.metric, v.value)}
									</td>
								{/each}
								<td class="py-1.5 pr-3 font-mono text-muted-foreground">
									{row.delta === null ? '비교 불가' : fmtValue(row.metric, row.delta)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<!-- 프로젝트별 집계 -->
	<section class="rounded-xl border border-border bg-surface p-5">
		<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
			<div>
				<p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">프로젝트별 집계</p>
				<h3 class="mt-1 text-lg font-semibold tracking-tight">{projectAggregates.length}개 프로젝트</h3>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<label class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
					시작
					<input
						type="date"
						bind:value={dateFrom}
						class="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
					/>
				</label>
				<label class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
					종료
					<input
						type="date"
						bind:value={dateTo}
						class="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
					/>
				</label>
				<label class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
					모델
					<input
						type="text"
						list="cse-analysis-models"
						bind:value={modelFilterText}
						placeholder="전체"
						class="w-28 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
					/>
					<datalist id="cse-analysis-models">
						{#each allModels as model (model)}
							<option value={model}></option>
						{/each}
					</datalist>
				</label>
				{#if dateFrom || dateTo || modelFilterText}
					<button
						type="button"
						onclick={clearAggregateFilters}
						class="text-[11px] font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
					>
						조건 해제
					</button>
				{/if}
			</div>
		</div>

		{#if projectAggregates.length === 0}
			<p class="rounded-md border border-dashed border-border bg-background px-4 py-6 text-center text-xs text-muted-foreground">
				조건에 맞는 세션이 없습니다.
			</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full min-w-[36rem] border-collapse text-xs">
					<thead>
						<tr class="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
							<th class="py-1.5 pr-3 font-medium">프로젝트</th>
							<th class="py-1.5 pr-3 font-medium">세션 수</th>
							<th class="py-1.5 pr-3 font-medium">총 메시지</th>
							<th class="py-1.5 pr-3 font-medium">총 토큰</th>
							<th class="py-1.5 pr-3 font-medium">평균 메시지</th>
							<th class="py-1.5 pr-3 font-medium">평균 토큰</th>
							<th class="py-1.5 pr-3 font-medium">최근 활동</th>
						</tr>
					</thead>
					<tbody>
						{#each projectAggregates as row (row.project)}
							<tr class="border-b border-border/60">
								<td class="py-1.5 pr-3">
									<button
										type="button"
										onclick={() => onOpenProject(row.project)}
										class="inline-flex items-center gap-1 font-medium text-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-ring/40"
									>
										<Folder class="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
										<span class="max-w-[14rem] truncate">{row.project}</span>
									</button>
								</td>
								<td class="py-1.5 pr-3 font-mono">{row.sessionCount}</td>
								<td class="py-1.5 pr-3 font-mono">{row.totalMessages.toLocaleString()}</td>
								<td class="py-1.5 pr-3 font-mono">{row.totalTokens.toLocaleString()}</td>
								<td class="py-1.5 pr-3 font-mono">{row.avgMessages.toFixed(1)}</td>
								<td class="py-1.5 pr-3 font-mono">{row.avgTokens.toFixed(1)}</td>
								<td class="py-1.5 pr-3 font-mono text-muted-foreground">{fmtTimestamp(row.lastActivity)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>
