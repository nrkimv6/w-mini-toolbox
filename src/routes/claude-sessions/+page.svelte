<script lang="ts">
	// Phase 4 — 페이지 통합. Phase 1~3이 만든 셸/컴포넌트를 실제 동작하는 화면으로 엮는다.
	// 재사용: transcript-viewer/parser.ts(parseTranscript)만 import — 수정 금지.
	import { parseTranscript } from '$lib/tools/transcript-viewer/parser.js';
	import type { ParseResult, RenderMessage } from '$lib/tools/transcript-viewer/types.js';
	import EntryPanel from '$lib/tools/claude-sessions/components/EntryPanel.svelte';
	import PrivacyNotice from '$lib/tools/claude-sessions/components/PrivacyNotice.svelte';
	import MetaBar from '$lib/tools/claude-sessions/components/MetaBar.svelte';
	import FilterControls from '$lib/tools/claude-sessions/components/FilterControls.svelte';
	import DetailToolbar from '$lib/tools/claude-sessions/components/DetailToolbar.svelte';
	import MessageBlock from '$lib/tools/claude-sessions/components/MessageBlock.svelte';
	import { FileWarning } from 'lucide-svelte';

	// item 18 — view 상태머신. `scanning`/`list` kind는 폴더 스캐너·세션 목록 화면(이 child 범위 밖,
	// 소유 미결정) 전용으로 나중에 추가될 수 있으므로 kind 값을 확장 가능한 discriminated union으로
	// 열어 두되, 그 두 kind는 지금 만들지 않는다. `loading`은 이 child의 필수 요구사항(design prompt
	// 28행 "읽는 중" 상태 노출)이라 지금 구현한다.
	type ViewState =
		| { kind: 'entry' }
		| { kind: 'loading'; fileName: string }
		| { kind: 'detail'; fileName: string; result: ParseResult };

	let view = $state<ViewState>({ kind: 'entry' });

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
		view = { kind: 'detail', fileName: file.name, result };
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
	}

	function backToStart() {
		view = { kind: 'entry' };
		readError = null;
		resetFilters();
		resetExpand();
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
			<EntryPanel onFilePicked={openFile} {readError} />
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
				/>

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
