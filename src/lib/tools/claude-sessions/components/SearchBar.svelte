<script lang="ts">
	// Phase 2 (item 3~5) — 상세 내 검색 입력 + debounce + 일치 건수/순서 표기 + 이동 버튼
	// (design prompt 135~141행)
	//
	// 배치 관계(item 3 요구): design-port `_todo-1` 시각 명세표에는 이 화면(상세)의 검색 입력에
	// 대한 항목이 없다 — 명세표의 "검색 블록"(249행, zip 506~519)은 세션 **목록** 화면(진입
	// 단계에서 프로젝트별 세션을 찾는 검색)이고, 이 컴포넌트는 이미 열린 세션 **내부**에서
	// 메시지를 찾는 별개 기능이라 대상이 다르다. 배치는 명세표 부재 상태에서 아래 규칙을
	// 유도했다: DetailToolbar는 이미 3개 버튼(모두 펼치기/접기/다른 파일 열기)을 한 줄에 담고
	// 있고, item 9가 "좁은 화면에서 검색 입력과 카운트/이동 버튼이 겹치거나 잘리지 않아야 한다"를
	// 요구한다 — 같은 줄에 우겨넣으면 좁은 화면에서 필연적으로 겹치므로, SearchBar는
	// DetailToolbar **아래 별도 줄**에 배치한다(입력 시각 자체는 zip 509~520의 `relative` 입력 +
	// 포커스 링 스타일을 재사용).
	//
	// debounce 계약(item 4): 이 컴포넌트는 입력 즉시값(`draft`, 로컬 state — 입력 필드가 그대로
	// 반영해야 타이핑이 끊겨 보이지 않는다)과 debounce된 확정값(`query`, bindable prop — 부모가
	// 필터/하이라이트에 사용)을 분리해서 소유한다. 확정값만 밖으로 내보내는 이유: 매 키 입력마다
	// 부모 쪽 `buildMatchIndex`/하이라이트 재계산이 돌면 큰 세션에서 타이핑이 버벅인다.
	import { onDestroy } from 'svelte';
	import { Search, X, ChevronUp, ChevronDown } from 'lucide-svelte';

	let {
		query = $bindable(''),
		matchCount,
		currentMatch,
		onNext,
		onPrev
	}: {
		/** debounce된 확정 검색어. 부모가 이 값으로 필터/하이라이트를 계산한다. */
		query?: string;
		/** 현재 일치 건수 (0 이상) */
		matchCount: number;
		/** 현재 확인 중인 일치 순서 (0-based). 일치가 없으면 -1 */
		currentMatch: number;
		onNext: () => void;
		onPrev: () => void;
	} = $props();

	/** debounce 지연 150ms — `/transcript`(같은 프로젝트의 기존 검색 입력)와 동일 값을 맞춰
	 * 두 화면의 체감 반응 속도를 통일한다. 너무 짧으면 큰 세션에서 매 키 입력마다 재계산 부담이
	 * 커지고, 너무 길면 "즉시 반응"처럼 느껴지지 않는다. */
	const DEBOUNCE_MS = 150;

	let draft = $state(query);
	let inputEl = $state<HTMLInputElement | undefined>(undefined);
	let timer: ReturnType<typeof setTimeout> | undefined;

	// T4 라이브 검증(2026-07-23)에서 발견 — 부모가 `searchContext.query`를 외부에서 직접
	// 초기화하면(예: 일치 0건 배너의 "검색 해제" 버튼, `+page.svelte`의 `resetSearch()`) 이
	// 컴포넌트 내부 `draft`는 갱신되지 않아 입력창에 지운 검색어가 그대로 남아 있었다. 대기 중인
	// debounce 타이머가 없을 때만(= 내 자신의 타이핑 중이 아닐 때만) draft를 query에 맞춘다 —
	// 타이핑 중에는 timer가 걸려 있어 이 동기화가 최신 입력을 덮지 않는다.
	$effect(() => {
		if (timer === undefined && draft !== query) {
			draft = query;
		}
	});

	function scheduleCommit(next: string) {
		// 대기 중이던 이전 타이머를 취소한다 — 늦게 도착한 이전 입력이 최신 입력을 덮지 않게 한다.
		if (timer !== undefined) clearTimeout(timer);
		timer = setTimeout(() => {
			query = next;
			timer = undefined;
		}, DEBOUNCE_MS);
	}

	function handleInput(e: Event) {
		const next = (e.currentTarget as HTMLInputElement).value;
		draft = next;
		scheduleCommit(next);
	}

	function clear() {
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
		draft = '';
		query = '';
		inputEl?.focus();
	}

	onDestroy(() => {
		if (timer !== undefined) clearTimeout(timer);
	});

	/** Enter/Shift+Enter로 다음/이전 이동. 이 입력은 <form> 안에 있지 않지만, 향후 래핑되더라도
	 * 페이지 리로드가 발생하지 않도록 기본 동작을 명시적으로 막는다. */
	function handleKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		if (matchCount === 0) return;
		if (e.shiftKey) onPrev();
		else onNext();
	}
</script>

<div class="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3">
	<div class="relative min-w-[14rem] flex-1">
		<Search
			class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
			aria-hidden="true"
		/>
		<input
			bind:this={inputEl}
			type="text"
			value={draft}
			oninput={handleInput}
			onkeydown={handleKeydown}
			aria-label="상세 내용 검색"
			placeholder="본문, 도구 이름, 도구 입력(파일 경로) 검색…"
			class="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
		/>
		{#if draft}
			<button
				type="button"
				onclick={clear}
				aria-label="검색어 지우기"
				class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
			>
				<X class="size-3.5" aria-hidden="true" />
			</button>
		{/if}
	</div>

	{#if query.trim()}
		<!-- 현재/전체 카운트 — 자릿수가 바뀌어도 레이아웃이 흔들리지 않도록 tabular-nums 고정폭 -->
		<span class="font-mono text-[10px] tabular-nums text-muted-foreground" aria-live="polite">
			{matchCount === 0 ? '0 / 0' : `${currentMatch + 1} / ${matchCount}`}
		</span>

		<div class="flex items-center gap-1">
			<button
				type="button"
				onclick={onPrev}
				disabled={matchCount === 0}
				aria-label="이전 일치 항목"
				class="rounded-md border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-40"
			>
				<ChevronUp class="size-3.5" aria-hidden="true" />
			</button>
			<button
				type="button"
				onclick={onNext}
				disabled={matchCount === 0}
				aria-label="다음 일치 항목"
				class="rounded-md border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-40"
			>
				<ChevronDown class="size-3.5" aria-hidden="true" />
			</button>
		</div>
	{/if}
</div>
