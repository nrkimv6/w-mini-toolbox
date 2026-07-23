<script lang="ts">
	// Phase 4 — 페이지 통합. Phase 1~3이 만든 셸/컴포넌트를 실제 동작하는 화면으로 엮는다.
	// 재사용: transcript-viewer/parser.ts(parseTranscript)만 import — 수정 금지.
	import { tick, setContext } from 'svelte';
	import { parseTranscript } from '$lib/tools/transcript-viewer/parser.js';
	import type { ParseResult, RenderMessage, SessionSummary } from '$lib/tools/transcript-viewer/types.js';
	import {
		isFileSystemAccessSupported,
		scanClaudeProjectsDirectory
	} from '$lib/tools/transcript-viewer/sessionScanner.js';
	import { SEARCH_CONTEXT_KEY } from '$lib/tools/transcript-viewer/search.js';
	import EntryPanel from '$lib/tools/claude-sessions/components/EntryPanel.svelte';
	import PrivacyNotice from '$lib/tools/claude-sessions/components/PrivacyNotice.svelte';
	import MetaBar from '$lib/tools/claude-sessions/components/MetaBar.svelte';
	import FilterControls from '$lib/tools/claude-sessions/components/FilterControls.svelte';
	import DetailToolbar from '$lib/tools/claude-sessions/components/DetailToolbar.svelte';
	import SearchBar from '$lib/tools/claude-sessions/components/SearchBar.svelte';
	import MessageBlock from '$lib/tools/claude-sessions/components/MessageBlock.svelte';
	import SessionList from '$lib/tools/claude-sessions/components/SessionList.svelte';
	import { buildMatchIndex, stepMatch, clampCurrent, type DetailSearchContext } from '$lib/tools/claude-sessions/searchNav.js';
	import { FileWarning, RotateCcw } from 'lucide-svelte';

	// item 18 — view 상태머신. `_todo-2`(2026-07-23 재타겟)가 `scanning`/`list` kind를 이 child의
	// 범위로 확정해 추가한다: `scanning`은 `showDirectoryPicker()` 이후 `scanClaudeProjectsDirectory`
	// 완료까지의 폴더 스캔 로딩 상태, `list`는 스캔된 세션 목록 화면이다. `loading`은 단일 파일
	// 진입(design prompt 28행 "읽는 중" 상태 노출) 전용으로 그대로 유지한다.
	type ViewState =
		| { kind: 'entry' }
		| { kind: 'loading'; fileName: string }
		| { kind: 'scanning' }
		| { kind: 'list' }
		| { kind: 'detail'; fileName: string; result: ParseResult };

	let view = $state<ViewState>({ kind: 'entry' });

	// item 9(재타겟) — 폴더 스캔 결과와, 목록 경유로 상세에 진입했는지 여부.
	// `fromList`는 상세 뷰의 "목록으로" 버튼 노출 조건(item 12)과 `reset` 계열 함수의 복귀 대상을 결정한다.
	let sessions = $state<SessionSummary[]>([]);
	let fromList = $state(false);

	// EntryPanel의 readError prop 계약(Phase 2 메모) — 파일 전체를 읽지 못한 경우(86행)와
	// 예상하지 못한 파싱 오류(90행)를 모두 이 배너 하나로 안내한다. 두 경로 모두 "로컬 파일은
	// 변경되지 않았습니다" 문구를 reason에 포함해 90행 요구를 충족시킨다.
	let readError = $state<{ fileName: string; reason: string } | null>(null);

	// item 20 — 필터 파이프라인 상태. FilterControls의 4개 $bindable prop과 동일한 이름으로 소유한다.
	let showMessages = $state(true);
	let showToolCalls = $state(true);
	let showThinking = $state(true);
	let showCompactHistory = $state(true);

	// item 13/DetailToolbar 계약 — 전체 펼치기/접기 신호. ThinkingCard/ToolCard가 "신호 변화"만 감지한다.
	let expandSignal = $state(0);
	let expandValue = $state(true);

	// Phase 3 (item 6) — 검색 상태. `searchContext.query`는 SearchBar가 debounce를 마친 뒤에만
	// 갱신하는 확정값이다(입력 즉시값은 SearchBar 내부 로컬 state로만 존재하고 여기까지 올라오지
	// 않는다 — 매 키 입력마다 buildMatchIndex/하이라이트가 전체 트리에서 재계산되는 것을 막기
	// 위해서다). `SEARCH_CONTEXT_KEY`는 transcript-viewer/search.ts에서 그대로 재사용한다(신규 키
	// 정의 금지 — `/transcript`와 동시 마운트되지 않으므로 충돌 없음).
	const searchContext: DetailSearchContext = $state({ query: '', currentLineIndex: -1 });
	setContext<DetailSearchContext>(SEARCH_CONTEXT_KEY, searchContext);
	let currentMatch = $state(0);

	function resetSearch() {
		searchContext.query = '';
		currentMatch = 0;
	}

	/** 압축 이력 판정 — 구조화 필드만 사용한다(자유텍스트 regex 금지, CLAUDE.md 규칙). */
	function isCompactHistoryMessage(m: RenderMessage): boolean {
		return m.subtype === 'compact_boundary' || m.isCompactSummary === true;
	}

	/**
	 * "역할별 메시지" 토글(showMessages)이 끄는 대상 — 텍스트 블록만 있고 도구 호출/사고 내용이
	 * 전혀 없는 순수 텍스트 메시지. 도구 호출·사고 내용을 포함한 메시지는 그 자체 토글
	 * (showToolCalls/showThinking)이 블록 단위로 처리하므로 이 메시지 단위 숨김에서는 제외한다
	 * (Phase 3 메모 "미해결 설계 질문"의 두 번째 해석을 채택 — Phase 4 소유 결정).
	 */
	function isTextOnlyMessage(m: RenderMessage): boolean {
		return (
			m.content.some((b) => b.type === 'text') &&
			!m.content.some((b) => b.type === 'tool_use' || b.type === 'thinking')
		);
	}

	const totalCount = $derived(view.kind === 'detail' ? view.result.messages.length : 0);

	const visibleMessages = $derived.by(() => {
		if (view.kind !== 'detail') return [] as RenderMessage[];
		return view.result.messages.filter((m) => {
			if (isCompactHistoryMessage(m) && !showCompactHistory) return false;
			if (!showMessages && isTextOnlyMessage(m)) return false;
			return true;
		});
	});

	const visibleCount = $derived(visibleMessages.length);

	// Phase 3 (item 7) — 검색과 필터의 조합 순서: 필터(전체 메시지) → 표시 대상(visibleMessages,
	// 위에서 이미 계산됨) → buildMatchIndex(표시 대상, 검색어). 검색이 필터 상태 자체를 바꾸지
	// 않는다(141행) — 그래서 buildMatchIndex는 항상 "필터를 통과한 배열"을 입력으로 받는다.
	//
	// 비일치 메시지를 숨길지(item 7 결정): **숨기지 않는다.** 138행은 "메시지와 메시지 안의
	// 일치 부분을 확인"만 요구하고 숨김을 요구하지 않으며, 숨기려면 검색 활성 시에만 적용되는
	// 별도 표시 상태가 필요한데 그러면 141행("검색 해제 시 표시 조건이 그대로 남는다")과
	// 충돌한다 — 필터 4종(showMessages 등) 외에 검색이 만드는 다섯 번째 숨김 축이 생기고, 해제
	// 시 그 축만 되돌리는 코드가 필요해진다(OR 합성 계약 위반 신호). 대신 일치 항목은 이동
	// 버튼으로 도달하고(137행), 하이라이트로 어디에 있는지 보여준다(138행).
	const matches = $derived(buildMatchIndex(visibleMessages, searchContext.query));

	// item 15 — 일치 0건 배너에서 "필터 때문에 안 보이는지" "검색어 자체가 없는지"를 구분하기
	// 위해, 필터를 적용하지 않은 전체 메시지 기준 일치도 함께 계산한다(검색이 활성 상태일 때만
	// 의미가 있으므로 비활성 시 빈 배열로 둬 불필요한 계산을 피한다).
	const matchesInAll = $derived.by(() => {
		if (view.kind !== 'detail' || !searchContext.query.trim()) return [] as number[];
		return buildMatchIndex(view.result.messages, searchContext.query);
	});

	const searchActive = $derived(searchContext.query.trim().length > 0);

	// item 8 — 검색어/필터 변경으로 matches.length가 바뀔 때마다 currentMatch를 유효 범위로
	// 보정한다. clampCurrent는 유효 범위 안이면 그대로 두므로 이 effect는 실제 보정이 필요할
	// 때만 currentMatch를 바꾸고, 그 다음 재실행에서는 안정 상태로 수렴한다(무한 루프 없음).
	$effect(() => {
		currentMatch = clampCurrent(matches.length, currentMatch);
	});

	// item 11 — "현재 확인 중인 일치" 메시지의 lineIndex를 컨텍스트에 반영한다. TextContent/
	// ToolCard/ThinkingCard가 이 값과 자기 메시지의 lineIndex를 비교해 강조 변형을 적용한다.
	$effect(() => {
		searchContext.currentLineIndex =
			currentMatch >= 0 && currentMatch < matches.length
				? visibleMessages[matches[currentMatch]].lineIndex
				: -1;
	});

	function nextMatch() {
		currentMatch = stepMatch(matches.length, currentMatch, 1);
	}

	function prevMatch() {
		currentMatch = stepMatch(matches.length, currentMatch, -1);
	}

	// Phase 6 (item 14) — 일치 이동 시 대상 메시지로 스크롤 + 포커스. tick()으로 자동 펼침(검색
	// 매칭으로 카드가 열리는 것) 반영 이후의 DOM 상태를 기다린 뒤 스크롤한다 — 펼침 전에
	// 스크롤하면 카드 높이가 나중에 바뀌어 위치가 어긋난다.
	$effect(() => {
		const lineIndex = searchContext.currentLineIndex;
		if (lineIndex < 0) return;
		tick().then(() => {
			const el = document.getElementById(`cse-msg-${lineIndex}`);
			if (!el) return;
			el.scrollIntoView({ block: 'center' });
			// 키보드/스크린리더 사용자가 이동 결과를 인지할 수 있도록 포커스를 옮긴다(137·136행).
			el.setAttribute('tabindex', '-1');
			el.focus({ preventScroll: true });
		});
	});

	function resetFilters() {
		showMessages = true;
		showToolCalls = true;
		showThinking = true;
		showCompactHistory = true;
	}

	function resetExpand() {
		expandSignal = 0;
		expandValue = true;
	}

	// item 19 — 파일 열기 흐름: 드롭/선택(EntryPanel.onFilePicked) → File.text() → parseTranscript →
	// view = detail. 읽는 중 상태를 노출하고(28행, role="status"/aria-live="polite"는 마크업에서 부여),
	// 실패 시 9번 오류 배너(EntryPanel readError)로 되돌린다.
	async function openFile(file: File) {
		view = { kind: 'loading', fileName: file.name };

		let text: string;
		try {
			text = await file.text();
		} catch (err) {
			// design prompt 86행 — 파일 전체를 읽지 못한 경우
			readError = {
				fileName: file.name,
				reason: `파일을 읽지 못했습니다. 로컬 파일은 변경되지 않았습니다. (${
					err instanceof Error ? err.message : String(err)
				})`
			};
			view = { kind: 'entry' };
			return;
		}

		let result: ParseResult;
		try {
			result = parseTranscript(text);
		} catch (err) {
			// design prompt 90행 — 예상하지 못한 오류
			readError = {
				fileName: file.name,
				reason: `세션을 해석하는 중 예상하지 못한 오류가 발생했습니다. 로컬 파일은 변경되지 않았습니다. (${
					err instanceof Error ? err.message : String(err)
				})`
			};
			view = { kind: 'entry' };
			return;
		}

		readError = null;
		resetFilters();
		resetExpand();
		resetSearch();
		fromList = false;
		view = { kind: 'detail', fileName: file.name, result };
	}

	// item 10(재타겟) — "폴더 열기" 진입점. `showDirectoryPicker()` → 스캔 → `list` 전환.
	// picker 취소(`AbortError`)는 조용히 무시한다(item 10 요구사항).
	async function openFolder() {
		if (!window.showDirectoryPicker) return;
		view = { kind: 'scanning' };
		try {
			const handle = await window.showDirectoryPicker();
			sessions = await scanClaudeProjectsDirectory(handle);
			view = { kind: 'list' };
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') {
				view = { kind: 'entry' };
				return;
			}
			readError = {
				fileName: '(폴더)',
				reason: `폴더를 여는 중 오류가 발생했습니다. 로컬 파일은 변경되지 않았습니다. (${
					err instanceof Error ? err.message : String(err)
				})`
			};
			view = { kind: 'entry' };
		}
	}

	// item 11(재타겟) — 목록에서 세션 선택 시 `fileHandle`로 다시 읽어 상세로 전환한다.
	// `fileHandle`이 없는 구형 결과는 조용히 무시한다(item 11 대체 옵션).
	async function openFromList(path: string) {
		const session = sessions.find((s) => s.path === path);
		if (!session?.fileHandle) return;

		view = { kind: 'loading', fileName: session.path };
		try {
			const file = await session.fileHandle.getFile();
			const text = await file.text();
			const result = parseTranscript(text);
			readError = null;
			resetFilters();
			resetExpand();
			resetSearch();
			fromList = true;
			view = { kind: 'detail', fileName: session.path, result };
		} catch {
			// 목록에서 선택한 세션을 열지 못한 경우 — 목록으로 조용히 되돌린다.
			view = { kind: 'list' };
		}
	}

	/** item 12(재타겟) — 목록 경유로 진입한 상세 뷰에서 목록으로 되돌아간다. */
	function backToList() {
		view = { kind: 'list' };
	}

	function expandAll() {
		expandValue = true;
		expandSignal += 1;
	}

	function collapseAll() {
		expandValue = false;
		expandSignal += 1;
	}

	/** design prompt 82행 — 진입 화면의 파일 선택 경로를 재사용한다(EntryPanel 재마운트). */
	function openAnotherFile() {
		view = { kind: 'entry' };
		readError = null;
		fromList = false;
	}

	function backToStart() {
		view = { kind: 'entry' };
		readError = null;
		fromList = false;
		resetFilters();
		resetExpand();
		resetSearch();
	}
</script>

<svelte:head>
	<title>Claude Code Session Explorer</title>
</svelte:head>

<div class="min-h-screen bg-canvas text-foreground">
	<!-- design prompt 12~13행 — 모든 상태에서 로컬 처리·읽기 전용 안내가 보여야 하므로 view 분기 밖,
	     최상위 wrapper 상단에 정확히 1곳만 렌더한다(Phase 2 메모 배치 계약). -->
	<PrivacyNotice />

	<div class="mx-auto max-w-[1400px] px-6 py-10">
		<header class="mb-8 flex items-end justify-between border-b border-border pb-6">
			<div>
				<p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
					로컬 · 읽기 전용
				</p>
				<h1 class="mt-1 text-2xl font-semibold tracking-tight">Claude Code Session Explorer</h1>
				<p class="mt-1 text-sm text-muted-foreground">
					로컬 폴더의 Claude Code <code class="font-mono text-xs">.jsonl</code> 세션 기록을 확인합니다.
				</p>
			</div>
			<button
				type="button"
				onclick={backToStart}
				class="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40"
			>
				처음부터
			</button>
		</header>

		{#if view.kind === 'entry'}
			<EntryPanel
				onFilePicked={openFile}
				{readError}
				onOpenFolder={openFolder}
				folderSupported={isFileSystemAccessSupported()}
			/>
		{:else if view.kind === 'scanning'}
			<!-- item 10(재타겟) — 폴더 스캔 중 상태 -->
			<div
				role="status"
				aria-live="polite"
				class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center text-sm text-muted-foreground"
			>
				<span>폴더를 스캔하는 중입니다…</span>
			</div>
		{:else if view.kind === 'list'}
			<!-- item 8~9(재타겟) — 세션 목록 -->
			<SessionList {sessions} onselect={openFromList} />
		{:else if view.kind === 'loading'}
			<!-- design prompt 28행 — 읽는 중 상태 -->
			<div
				role="status"
				aria-live="polite"
				class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center text-sm text-muted-foreground"
			>
				<span class="font-mono text-xs">{view.fileName}</span>
				<span>세션을 읽는 중입니다…</span>
			</div>
		{:else if view.kind === 'detail'}
			{@const result = view.result}
			<div class="flex flex-col gap-6">
				<MetaBar meta={result.meta} errors={result.errors} fileName={view.fileName} />
				<DetailToolbar
					onExpandAll={expandAll}
					onCollapseAll={collapseAll}
					onOpenAnotherFile={openAnotherFile}
					onBackToList={fromList ? backToList : undefined}
				/>

				{#if result.messages.length > 0}
					<!-- Phase 2 (item 3) — DetailToolbar 아래 별도 줄에 배치(근거: SearchBar.svelte 주석) -->
					<SearchBar
						bind:query={searchContext.query}
						matchCount={matches.length}
						{currentMatch}
						onNext={nextMatch}
						onPrev={prevMatch}
					/>

					{#if searchActive && matches.length === 0}
						<!-- item 15 — 일치 0건: 검색어 자체 때문인지, 필터가 가려서인지 문구로 구분한다 -->
						<div
							role="status"
							aria-live="polite"
							class="rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center"
						>
							<p class="text-sm font-medium text-foreground">
								"{searchContext.query.trim()}"에 대한 일치 항목이 없습니다.
							</p>
							<p class="mt-1 text-xs text-muted-foreground">
								{#if matchesInAll.length > 0}
									현재 필터에 가려진 메시지 안에 {matchesInAll.length}건의 일치가 있습니다. 필터를 해제하면 볼 수 있습니다.
								{:else}
									다른 검색어를 입력하거나 검색을 해제해 보세요.
								{/if}
							</p>
							<button
								type="button"
								onclick={resetSearch}
								class="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40"
							>
								<RotateCcw class="size-3" aria-hidden="true" />
								검색 해제
							</button>
						</div>
					{/if}
				{/if}

				{#if result.messages.length === 0}
					<!-- design prompt 88행 — 손상되거나 비어 있는 세션: 발견된 문제 + 다음 조작 -->
					<div
						role="status"
						aria-live="polite"
						class="rounded-xl border border-dashed border-warning/40 bg-warning-soft px-6 py-14 text-center"
					>
						<p class="text-sm font-medium text-foreground">
							{#if result.errors.length > 0}
								이 세션 파일의 모든 줄을 해석하지 못했습니다.
							{:else}
								이 세션 파일에는 표시할 메시지가 없습니다.
							{/if}
						</p>
						<p class="mt-1 text-xs text-muted-foreground">
							{#if result.errors.length > 0}
								파싱 실패 {result.errors.length}건 — 파일이 손상됐거나 지원하지 않는 형식일 수 있습니다.
							{:else}
								파일이 비어 있습니다.
							{/if}
						</p>
						<button
							type="button"
							onclick={openAnotherFile}
							class="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40"
						>
							다른 파일 열기
						</button>
					</div>
				{:else}
					{#if result.errors.length > 0}
						<!-- design prompt 87행 — 일부 라인 실패: 정상 메시지는 계속 표시 + 건너뛴 라인 수 노출 -->
						<div
							role="status"
							aria-live="polite"
							class="flex items-center gap-2 rounded-md border border-warning/40 bg-warning-soft px-4 py-2 text-xs text-warning-foreground"
						>
							<FileWarning class="size-3.5 shrink-0" aria-hidden="true" />
							<span>{result.errors.length}줄을 해석하지 못해 건너뛰었습니다. 나머지 메시지는 계속 표시됩니다.</span>
						</div>
					{/if}

					<FilterControls
						bind:showMessages
						bind:showToolCalls
						bind:showThinking
						bind:showCompactHistory
						{visibleCount}
						{totalCount}
					/>

					<div class="flex flex-col gap-3">
						{#if visibleMessages.length === 0}
							<MessageBlock message={null} onClearAll={resetFilters} />
						{:else}
							{#each visibleMessages as message (message.lineIndex)}
								<MessageBlock {message} {showToolCalls} {showThinking} {expandSignal} {expandValue} />
							{/each}
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
