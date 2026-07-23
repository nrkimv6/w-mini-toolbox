<script lang="ts">
	import { setContext } from 'svelte';
	import { parseTranscript } from '$lib/tools/transcript-viewer/parser.js';
	import type { ParseResult, RenderMessage, TextBlock } from '$lib/tools/transcript-viewer/types.js';
	import MessageBlock from '$lib/tools/transcript-viewer/components/MessageBlock.svelte';
	import { shouldShowHeader, shouldShowDateDivider } from '$lib/tools/transcript-viewer/speakerGrouping.js';
	import DateDivider from '$lib/tools/transcript-viewer/components/DateDivider.svelte';
	import StatsBar from '$lib/tools/transcript-viewer/components/StatsBar.svelte';
	import TokenTimeline from '$lib/tools/transcript-viewer/components/TokenTimeline.svelte';
	import DiagnosticsPanel from '$lib/tools/transcript-viewer/components/DiagnosticsPanel.svelte';
	import { computeDiagnostics } from '$lib/tools/transcript-viewer/diagnostics.js';
	import { matchesQuery, SEARCH_CONTEXT_KEY, type SearchContext } from '$lib/tools/transcript-viewer/search.js';
	import TocSidebar, { type TocEntry } from '$lib/tools/transcript-viewer/components/TocSidebar.svelte';
	import SidechainGroup from '$lib/tools/transcript-viewer/components/SidechainGroup.svelte';
	import { groupSidechainRuns } from '$lib/tools/transcript-viewer/grouping.js';
	import { computeTokenStats } from '$lib/tools/transcript-viewer/stats.js';
	import { UploadCloud, ShieldCheck, FileWarning, ChevronsDown, ChevronsUp, FileJson, Search, X, List, ChevronDown, ChevronRight } from 'lucide-svelte';

	let result = $state<ParseResult | null>(null);
	let fileName = $state('');
	let isDragging = $state(false);
	let loading = $state(false);
	// 파싱 에러 배너 접이식 확장 토글
	let showParseErrors = $state(false);

	// role/type 필터
	let showUser = $state(true);
	let showAssistant = $state(true);
	let showSystem = $state(true);
	let showTool = $state(true);
	let showThinking = $state(true);
	// compact 흔적(경계 알림 + 이어받기 요약)은 기본 숨김
	let showCompact = $state(false);

	// 전체 펼치기/접기 (ToolCall/ThinkingBlock에 신호 전달)
	let expandSignal = $state(0);
	let expandValue = $state(true);

	// 검색: 입력은 즉시 반영하되, 필터링/하이라이트에 쓰는 값은 150ms debounce한다.
	let searchInput = $state('');
	const SEARCH_DEBOUNCE_MS = 150;
	// TextContent/ToolCall(MessageBlock 하위)에 prop 드릴링 없이 검색어를 전달하기 위한 context.
	// $state 프록시 객체를 그대로 넘겨 debounce된 query 갱신이 하위 컴포넌트에도 반응하게 한다.
	const searchContext: SearchContext = $state({ query: '' });
	setContext<SearchContext>(SEARCH_CONTEXT_KEY, searchContext);

	$effect(() => {
		const value = searchInput;
		const timer = setTimeout(() => {
			searchContext.query = value;
		}, SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	});

	function clearSearch() {
		searchInput = '';
		searchContext.query = '';
	}

	// 대화 목차(TOC) — 모바일에서는 드로어로 노출
	let tocDrawerOpen = $state(false);

	/** compact 흔적 여부 — 구조화 필드(subtype/isCompactSummary)만으로 판정 */
	function isCompactTrace(m: RenderMessage): boolean {
		return m.subtype === 'compact_boundary' || m.isCompactSummary === true;
	}

	/**
	 * 현재 필터 기준으로 실제 화면에 그려질 내용이 있는지.
	 * 빈 메타 라인(attachment/mode/last-prompt 등)과 tool_result만 담은
	 * 빈 사용자 발언을 숨기기 위한 판정.
	 */
	function hasVisibleContent(m: RenderMessage): boolean {
		for (const b of m.content) {
			if (b.type === 'text') {
				if (typeof (b as { text?: string }).text === 'string' && (b as { text: string }).text.trim())
					return true;
			} else if (b.type === 'thinking') {
				if (showThinking && typeof (b as { thinking?: string }).thinking === 'string' && (b as { thinking: string }).thinking.trim())
					return true;
			} else if (b.type === 'tool_use') {
				if (showTool) return true; // 도구 이름 노출은 허용
			} else if (b.type === 'tool_result') {
				continue; // 매칭된 tool_use 카드 내부에서만 표시
			} else {
				return true; // 알 수 없는 블록은 보존
			}
		}
		return false;
	}

	const filteredMessages = $derived.by(() => {
		if (!result) return [];
		return result.messages.filter((m) => {
			if (!showCompact && isCompactTrace(m)) return false;
			if (m.role === 'user' && !showUser) return false;
			if (m.role === 'assistant' && !showAssistant) return false;
			if (m.role === 'system' && !showSystem) return false;
			if (!hasVisibleContent(m)) return false;
			if (!matchesQuery(m, searchContext.query)) return false;
			return true;
		});
	});

	/** 메시지의 첫 텍스트 블록에서 첫 줄을 40자 내외로 요약한다. 텍스트가 없으면 null. */
	function firstTextSummary(m: RenderMessage): string | null {
		for (const b of m.content) {
			if (b.type === 'text' && typeof (b as TextBlock).text === 'string') {
				const trimmed = (b as TextBlock).text.trim();
				if (!trimmed) continue;
				const firstLine = trimmed.split('\n')[0].trim();
				if (!firstLine) continue;
				return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine;
			}
		}
		return null;
	}

	// 렌더 직전 filteredMessages를 sidechain(sub-agent) 연속 구간 기준으로 그룹핑한다.
	// 경계 판정은 isSidechain 불리언 필드만 사용(구조화 필드 — 자유텍스트 추론 없음).
	const renderGroups = $derived.by(() => groupSidechainRuns(filteredMessages));

	// 출력 토큰 이상치 임계값 — 필터와 무관하게 세션 전체(result.messages) 기준으로 고정한다.
	// (필터를 바꿀 때마다 임계값이 흔들리면 "이상치"의 의미가 바뀌어 버린다)
	const tokenStats = $derived.by(() => computeTokenStats(result?.messages ?? []));

	// 진단 요약 — 필터와 무관하게 세션 전체(result.messages) 기준으로 고정한다(TokenTimeline과 동일한 이유).
	const diagnostics = $derived.by(() => computeDiagnostics(result?.messages ?? []));

	// 목차는 원본 user 메시지 기준으로 고정한다(필터 소스로 삼으면 필터 변경 때마다 목차가 요동친다).
	// 필터로 숨겨진 항목은 visible: false로 표시해 흐리게 렌더할 수 있게 한다.
	const visibleLineIndexSet = $derived.by(() => new Set(filteredMessages.map((m) => m.lineIndex)));

	// 그룹 경계와 무관하게 filteredMessages의 실제 이웃 관계로 header 병합 여부를 판정한다.
	// (sidechain-group으로 묶인 항목 뒤에 이어지는 일반 메시지도 원래 이웃 규칙을 유지)
	const hideHeaderMap = $derived.by(() => {
		const map = new Map<number, boolean>();
		filteredMessages.forEach((m, i) => {
			map.set(m.lineIndex, !shouldShowHeader(filteredMessages[i - 1], m));
		});
		return map;
	});

	/** timestamp를 "YYYY년 M월 D일" 라벨로 포맷한다. 없거나 파싱 불가면 빈 문자열. */
	function formatDateLabel(ts?: string): string {
		if (!ts) return '';
		const d = new Date(ts);
		if (Number.isNaN(d.getTime())) return '';
		return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
	}

	// 날짜 변경지점 구분선 — 그룹 경계와 무관하게 filteredMessages의 원본 이웃 관계로 판정한다.
	// (hideHeaderMap과 동일한 이웃 판정 방식. 값이 빈 문자열이면 timestamp 없음/파싱 불가로
	// 구분선을 렌더하지 않는다.)
	const dateDividerMap = $derived.by(() => {
		const map = new Map<number, string>();
		filteredMessages.forEach((m, i) => {
			if (shouldShowDateDivider(filteredMessages[i - 1], m)) {
				map.set(m.lineIndex, formatDateLabel(m.timestamp));
			}
		});
		return map;
	});

	const tocEntries = $derived.by((): TocEntry[] => {
		if (!result) return [];
		const entries: TocEntry[] = [];
		for (const m of result.messages) {
			if (m.role !== 'user' || isCompactTrace(m)) continue;
			const summary = firstTextSummary(m);
			if (!summary) continue;
			entries.push({
				lineIndex: m.lineIndex,
				summary,
				timestamp: m.timestamp,
				visible: visibleLineIndexSet.has(m.lineIndex)
			});
		}
		return entries;
	});

	async function loadFile(file: File) {
		if (!file) return;
		loading = true;
		fileName = file.name;
		try {
			const text = await file.text();
			result = parseTranscript(text);
		} finally {
			loading = false;
		}
	}

	function handleFileInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) loadFile(file);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) loadFile(file);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function reset() {
		result = null;
		fileName = '';
	}

	function triggerExpandAll(value: boolean) {
		expandValue = value;
		expandSignal += 1;
	}
</script>

<svelte:head>
	<title>Transcript Viewer — Mini Toolbox</title>
</svelte:head>

<div class="min-h-screen bg-background pb-20">
	<div class="mx-auto flex max-w-6xl gap-6 px-4 py-8 lg:items-start">
	<div class="mx-auto w-full max-w-4xl flex-1">
		<div class="mb-6 text-center">
			<h1 class="mb-2 text-2xl font-bold tracking-tight lg:text-3xl">Transcript Viewer</h1>
			<p class="text-sm text-muted-foreground">Claude Code 세션(.jsonl) 파일을 브라우저에서 바로 읽어봅니다</p>
		</div>

		<div class="mb-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
			<ShieldCheck size={16} class="mt-0.5 shrink-0" />
			<span>파일은 브라우저에서만 처리됩니다. 서버로 업로드되지 않으며, 어디에도 저장되지 않습니다.</span>
		</div>

		{#if !result}
			<div
				role="button"
				tabindex="0"
				class="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors {isDragging
					? 'border-purple-400 bg-purple-50'
					: 'border-gray-300 bg-white'}"
				ondrop={handleDrop}
				ondragover={handleDragOver}
				ondragleave={handleDragLeave}
			>
				<UploadCloud size={40} class="text-gray-400" />
				<div>
					<p class="font-medium text-gray-700">.jsonl 파일을 여기로 드래그하거나</p>
					<label class="mt-2 inline-block cursor-pointer rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
						파일 선택
						<input type="file" accept=".jsonl" class="hidden" onchange={handleFileInput} />
					</label>
				</div>
				<p class="text-xs text-gray-400">~/.claude/projects/&lt;project&gt;/&lt;session&gt;.jsonl</p>
				{#if loading}
					<p class="text-xs text-purple-500">파싱 중...</p>
				{/if}
			</div>
		{:else}
			<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
				<div class="flex items-center gap-2 text-sm text-gray-600">
					<FileJson size={16} />
					<span class="font-medium">{fileName}</span>
				</div>
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
						onclick={() => triggerExpandAll(true)}
					>
						<ChevronsDown size={14} />
						모두 펼치기
					</button>
					<button
						type="button"
						class="flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
						onclick={() => triggerExpandAll(false)}
					>
						<ChevronsUp size={14} />
						모두 접기
					</button>
					<button
						type="button"
						class="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
						onclick={reset}
					>
						다른 파일 열기
					</button>
				</div>
			</div>

			<div class="mb-4">
				<StatsBar meta={result.meta} />
			</div>

			<div class="mb-4">
				<DiagnosticsPanel {diagnostics} />
			</div>

			<div class="mb-4">
				<TokenTimeline messages={result.messages} outlierThreshold={tokenStats.outlierThreshold} />
			</div>

			{#if result.errors.length > 0}
				<div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800">
					<button
						type="button"
						class="flex w-full items-center gap-2 px-3 py-2 text-left"
						onclick={() => (showParseErrors = !showParseErrors)}
					>
						{#if showParseErrors}
							<ChevronDown size={14} class="shrink-0" />
						{:else}
							<ChevronRight size={14} class="shrink-0" />
						{/if}
						<FileWarning size={16} class="shrink-0" />
						<span>파싱에 실패한 라인 {result.errors.length}개는 건너뛰었습니다.</span>
					</button>
					{#if showParseErrors}
						<ul class="space-y-2 border-t border-amber-200 px-3 py-2">
							{#each result.errors as err (err.lineIndex)}
								<li class="rounded border border-amber-200 bg-white/60 p-2">
									<div class="mb-1 flex items-center justify-between font-medium">
										<span>{err.lineIndex}번째 줄</span>
									</div>
									<div class="mb-1 text-amber-700">{err.error}</div>
									<pre class="overflow-x-auto rounded bg-gray-900 p-2 text-[11px] text-gray-100">{err.raw}</pre>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}

			<div class="mb-4 flex flex-wrap items-center gap-2">
				<div class="relative flex-1 min-w-[12rem]">
					<Search size={14} class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
					<input
						type="text"
						placeholder="검색 (본문 / 도구 이름·입력·결과)"
						class="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-8 text-xs text-gray-700 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none"
						bind:value={searchInput}
					/>
					{#if searchInput}
						<button
							type="button"
							class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
							onclick={clearSearch}
							aria-label="검색어 지우기"
						>
							<X size={14} />
						</button>
					{/if}
				</div>
				{#if searchContext.query.trim()}
					<span class="whitespace-nowrap text-xs text-gray-500">{filteredMessages.length}개 일치</span>
				{/if}
			</div>

			<div class="mb-4 flex flex-wrap items-center gap-2 text-xs">
				<span class="text-gray-400">필터:</span>
				<button
					type="button"
					class="rounded-full border px-2.5 py-1 {showUser ? 'border-purple-400 bg-purple-100 text-purple-700' : 'border-gray-200 text-gray-400'}"
					onclick={() => (showUser = !showUser)}
				>
					user
				</button>
				<button
					type="button"
					class="rounded-full border px-2.5 py-1 {showAssistant ? 'border-purple-400 bg-purple-100 text-purple-700' : 'border-gray-200 text-gray-400'}"
					onclick={() => (showAssistant = !showAssistant)}
				>
					assistant
				</button>
				<button
					type="button"
					class="rounded-full border px-2.5 py-1 {showSystem ? 'border-purple-400 bg-purple-100 text-purple-700' : 'border-gray-200 text-gray-400'}"
					onclick={() => (showSystem = !showSystem)}
				>
					system
				</button>
				<button
					type="button"
					class="rounded-full border px-2.5 py-1 {showTool ? 'border-blue-400 bg-blue-100 text-blue-700' : 'border-gray-200 text-gray-400'}"
					onclick={() => (showTool = !showTool)}
				>
					tool
				</button>
				<button
					type="button"
					class="rounded-full border px-2.5 py-1 {showThinking ? 'border-purple-400 bg-purple-100 text-purple-700' : 'border-gray-200 text-gray-400'}"
					onclick={() => (showThinking = !showThinking)}
				>
					thinking
				</button>
				<button
					type="button"
					class="rounded-full border px-2.5 py-1 {showCompact ? 'border-gray-400 bg-gray-200 text-gray-700' : 'border-gray-200 text-gray-400'}"
					onclick={() => (showCompact = !showCompact)}
				>
					compact
				</button>
			</div>

			{#if filteredMessages.length === 0}
				<p class="py-12 text-center text-sm text-gray-400">필터 조건에 맞는 메시지가 없습니다.</p>
			{:else}
				<div class="flex flex-col">
					{#each renderGroups as group, i (group.kind === 'message' ? group.message.lineIndex : `sc-${group.messages[0].lineIndex}`)}
						<div class={i === 0 ? '' : 'mt-4'}>
							{#if group.kind === 'message'}
								{@const hideHeader = hideHeaderMap.get(group.message.lineIndex) ?? false}
								{@const dateLabel = dateDividerMap.get(group.message.lineIndex)}
								{#if dateLabel}
									<DateDivider date={dateLabel} />
								{/if}
								<MessageBlock
									message={group.message}
									{showTool}
									{showThinking}
									{expandSignal}
									{expandValue}
									{hideHeader}
									outlierThreshold={tokenStats.outlierThreshold}
								/>
							{:else}
								<SidechainGroup messages={group.messages} {showTool} {showThinking} {expandSignal} {expandValue} />
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>

	{#if result && tocEntries.length > 0}
		<aside class="sticky top-8 hidden max-h-[calc(100vh-5rem)] w-64 shrink-0 overflow-y-auto lg:block">
			<div class="mb-2 px-2 text-xs font-semibold text-gray-500">대화 목차</div>
			<TocSidebar entries={tocEntries} />
		</aside>
	{/if}
	</div>

	{#if result && tocEntries.length > 0}
		<button
			type="button"
			class="fixed bottom-6 right-6 z-30 flex items-center gap-1 rounded-full bg-purple-600 px-4 py-2.5 text-xs font-medium text-white shadow-lg lg:hidden"
			onclick={() => (tocDrawerOpen = true)}
		>
			<List size={14} />
			목차
		</button>
	{/if}

	{#if tocDrawerOpen}
		<div class="fixed inset-0 z-40 flex justify-end lg:hidden">
			<button
				type="button"
				class="absolute inset-0 bg-black/40"
				aria-label="목차 닫기"
				onclick={() => (tocDrawerOpen = false)}
			></button>
			<div class="relative flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto bg-white p-4 shadow-xl">
				<div class="mb-3 flex items-center justify-between">
					<span class="text-sm font-semibold text-gray-700">대화 목차</span>
					<button type="button" aria-label="닫기" onclick={() => (tocDrawerOpen = false)}>
						<X size={16} />
					</button>
				</div>
				<TocSidebar entries={tocEntries} onJump={() => (tocDrawerOpen = false)} />
			</div>
		</div>
	{/if}
</div>
