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
	//
	// personalization Phase 2 (즐겨찾기) — 즐겨찾기 표시/해제는 이 컴포넌트가 소유하는 별도
	// 축(`favoritesOnly` 내부 state)으로 조합한다. 부모(+page.svelte)가 소유한 검색(`sessions`
	// prop이 이미 querySessions로 필터된 값)·정렬(sortKey/sortDir) 상태는 건드리지 않고, 그
	// 위에 favoritesOnly 필터를 얹기만 한다 — 검색/정렬을 덮어쓰지 않기 위한 설계다.
	// 즐겨찾기 키는 localRepository.ts의 `resolveFavoriteKey`(sessionId 우선, 없으면 path)만
	// 사용한다(자유텍스트 추론 금지).
	//
	// "찾을 수 없는 즐겨찾기" — `favorites`는 로컬 저장소 전체 즐겨찾기 목록(검색어로 걸러지지
	// 않은 원본)이고, `allSessionKeys`는 이번 스캔에서 발견된 모든 세션의 키 집합(검색어로
	// 걸러지지 않음)이다. 두 값을 비교해 "즐겨찾기했지만 이번 스캔에는 없는" 세션을 판정한다.
	// `sessions`(검색어로 걸러진 부분집합)만으로는 검색어 때문에 안 보이는 것과 실제로 없는
	// 것을 구분할 수 없어 별도 prop으로 받는다.
	//
	// Phase 2(분석·annotation, item 7) — 메모·태그 검색은 favoritesOnly와 동일하게 "부모(+page.svelte)
	// 검색/정렬 위에 얹는 별도 축(내부 state)"으로 추가한다. `annotations`(sessionKey → annotation)
	// 만 부모에게서 받고, 검색 텍스트/태그 조건 자체는 이 컴포넌트가 소유해 querySessions(카탈로그
	// 순수 함수)를 재호출한다 — sortSessions를 이 컴포넌트가 직접 호출하는 것과 동일한 패턴이다.
	import { tick } from 'svelte';
	import { Star, Tag, X } from 'lucide-svelte';
	import type { SessionSortKey, SessionSummary, SortDirection } from '$lib/tools/transcript-viewer/types.js';
	import { querySessions, sortSessions } from '$lib/tools/transcript-viewer/sessionCatalog.js';
	import {
		resolveFavoriteKey,
		type FavoriteEntry,
		type SessionAnnotation
	} from '$lib/tools/transcript-viewer/localRepository.js';
	import SessionListItem from './SessionListItem.svelte';

	let {
		sessions,
		loading = false,
		sortKey = 'lastActivity',
		sortDir = 'desc',
		focusedPath = $bindable<string | null>(null),
		onselect,
		favorites = [],
		allSessionKeys = new Set<string>(),
		onToggleFavorite,
		onRemoveOrphanedFavorite,
		annotations = new Map<string, SessionAnnotation>()
	}: {
		sessions: SessionSummary[];
		loading?: boolean;
		sortKey?: SessionSortKey;
		sortDir?: SortDirection;
		/** 현재 키보드 포커스 대상 경로. 목록→상세→목록 왕복 시 복원용으로 부모가 바인딩한다 */
		focusedPath?: string | null;
		onselect: (path: string) => void;
		/** 로컬 저장소 전체 즐겨찾기 목록(검색어로 걸러지지 않은 원본) */
		favorites?: FavoriteEntry[];
		/** 이번 스캔에서 발견된 모든 세션의 키 집합(검색어로 걸러지지 않음) — 즐겨찾기 유실 판정용 */
		allSessionKeys?: Set<string>;
		/** 즐겨찾기 표시/해제 토글. 로컬 저장소 연동은 +page.svelte 소유 */
		onToggleFavorite: (session: SessionSummary) => void;
		/** 찾을 수 없는(유실된) 즐겨찾기 1건 삭제 */
		onRemoveOrphanedFavorite?: (sessionKey: string) => void;
		/** 로컬 저장소 전체 메모·태그 목록(sessionKey → annotation) — 메모·태그 검색·태그 조건용 */
		annotations?: Map<string, SessionAnnotation>;
	} = $props();

	/** personalization Phase 2 — 즐겨찾기만 보기. 부모의 검색/정렬 상태와 별도 축(내부 state)이다 */
	let favoritesOnly = $state(false);

	/** Phase 2(분석·annotation) — 메모·태그 검색어 + 태그 조건(콤마 구분, AND). favoritesOnly와 동일하게 별도 축 */
	let annotationQuery = $state('');
	let tagFilterInput = $state('');

	const favoriteKeySet = $derived(new Set(favorites.map((f) => f.sessionKey)));
	const sorted = $derived(sortSessions(sessions, sortKey, sortDir));
	const favoritesFiltered = $derived(
		favoritesOnly ? sorted.filter((s) => favoriteKeySet.has(resolveFavoriteKey(s))) : sorted
	);
	const activeTagFilters = $derived(
		tagFilterInput
			.split(',')
			.map((t) => t.trim().toLowerCase())
			.filter((t) => t.length > 0)
	);
	const displayed = $derived(
		querySessions(favoritesFiltered, {
			text: annotationQuery.trim() || undefined,
			tags: activeTagFilters,
			annotations,
			includeAnnotationText: true
		})
	);

	/** 즐겨찾기했지만 이번 스캔 결과(전체, 검색어 무관)에서 찾을 수 없는 항목 */
	const orphanedFavorites = $derived(favorites.filter((f) => !allSessionKeys.has(f.sessionKey)));

	let itemEls: Record<string, HTMLButtonElement> = {};

	function indexOfFocused(): number {
		if (!focusedPath) return -1;
		return displayed.findIndex((s) => s.path === focusedPath);
	}

	function moveFocus(delta: number) {
		if (displayed.length === 0) return;
		const current = indexOfFocused();
		const next =
			current < 0 ? (delta > 0 ? 0 : displayed.length - 1) : Math.max(0, Math.min(displayed.length - 1, current + delta));
		focusedPath = displayed[next].path;
		tick().then(() => itemEls[displayed[next].path]?.focus());
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

	function favoriteLabel(session: SessionSummary): string {
		const isFav = favoriteKeySet.has(resolveFavoriteKey(session));
		const title = session.aiTitle ?? session.lastPromptPreview ?? session.sessionId ?? session.path;
		return isFav ? `${title} 즐겨찾기 해제` : `${title} 즐겨찾기 추가`;
	}

	function clearAnnotationSearch() {
		annotationQuery = '';
		tagFilterInput = '';
	}
</script>

<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2">
	<button
		type="button"
		onclick={() => (favoritesOnly = !favoritesOnly)}
		aria-pressed={favoritesOnly}
		class={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 ${
			favoritesOnly
				? 'border-primary/40 bg-primary/10 text-primary'
				: 'border-border bg-background text-muted-foreground hover:bg-secondary'
		}`}
	>
		<Star class="size-3" fill={favoritesOnly ? 'currentColor' : 'none'} aria-hidden="true" />
		즐겨찾기만 보기{#if favorites.length > 0}
			<span class="font-mono text-[10px] tabular-nums opacity-80">({favorites.length})</span>
		{/if}
	</button>

	<!-- Phase 2(분석·annotation, item 7) — 메모·태그 검색. 부모 검색창(제목/프로젝트/브랜치/ID)과
	     별도 입력이며, 아래 querySessions 호출에서 includeAnnotationText로 메모/태그도 함께 본다. -->
	<div class="flex flex-wrap items-center gap-1.5">
		<div class="relative">
			<Tag class="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
			<input
				type="text"
				bind:value={annotationQuery}
				aria-label="메모·태그 검색"
				placeholder="메모·태그 검색…"
				class="w-36 rounded-md border border-border bg-background py-1 pl-6 pr-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
			/>
		</div>
		<input
			type="text"
			bind:value={tagFilterInput}
			aria-label="태그 조건(콤마로 구분, 모두 포함)"
			placeholder="태그 조건(콤마 구분)"
			class="w-32 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
		/>
		{#if annotationQuery || tagFilterInput}
			<button
				type="button"
				onclick={clearAnnotationSearch}
				aria-label="메모·태그 검색 조건 해제"
				class="text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
			>
				<X class="size-3.5" aria-hidden="true" />
			</button>
		{/if}
	</div>
</div>

{#if orphanedFavorites.length > 0}
	<div
		role="status"
		aria-live="polite"
		class="mt-2 flex flex-col gap-1.5 rounded-lg border border-dashed border-warning/40 bg-warning-soft px-3 py-2 text-xs text-foreground"
	>
		<span>즐겨찾기 {orphanedFavorites.length}건을 현재 폴더에서 찾을 수 없습니다.</span>
		<ul class="flex flex-col gap-1">
			{#each orphanedFavorites as favorite (favorite.sessionKey)}
				<li class="flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
					<span class="truncate">{favorite.path}</span>
					{#if onRemoveOrphanedFavorite}
						<button
							type="button"
							onclick={() => onRemoveOrphanedFavorite?.(favorite.sessionKey)}
							aria-label={`${favorite.path} 즐겨찾기 기록 삭제`}
							class="shrink-0 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
						>
							<X class="size-3" aria-hidden="true" />
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}

<div class="mt-2">
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
	{:else if favoritesOnly && displayed.length === 0}
		<div
			role="status"
			aria-live="polite"
			class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center text-sm text-muted-foreground"
		>
			<span>
				{#if favorites.length === 0}
					즐겨찾기한 세션이 없습니다.
				{:else}
					즐겨찾기한 세션이 현재 검색 조건에 없습니다.
				{/if}
			</span>
		</div>
	{:else if displayed.length === 0}
		<!-- Phase 2(분석·annotation, item 7) — 메모·태그 검색/태그 조건으로 인해 0건인 경우 -->
		<div
			role="status"
			aria-live="polite"
			class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center text-sm text-muted-foreground"
		>
			<span>메모·태그 검색 조건에 맞는 세션이 없습니다.</span>
			{#if annotationQuery || tagFilterInput}
				<button
					type="button"
					onclick={clearAnnotationSearch}
					class="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
				>
					<X class="size-3" aria-hidden="true" />
					메모·태그 검색 조건 해제
				</button>
			{/if}
		</div>
	{:else}
		<div class="flex flex-col gap-2" role="listbox" aria-label="세션 목록">
			{#each displayed as s, index (s.path)}
				{@const isFav = favoriteKeySet.has(resolveFavoriteKey(s))}
				<div class="flex items-stretch gap-1.5">
					<button
						type="button"
						bind:this={itemEls[s.path]}
						class="min-w-0 flex-1 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
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
					<button
						type="button"
						onclick={() => onToggleFavorite(s)}
						aria-pressed={isFav}
						aria-label={favoriteLabel(s)}
						class={`shrink-0 self-stretch rounded-lg border px-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 ${
							isFav
								? 'border-primary/40 bg-primary/10 text-primary'
								: 'border-border bg-background text-muted-foreground hover:bg-secondary'
						}`}
					>
						<Star class="size-4" fill={isFav ? 'currentColor' : 'none'} aria-hidden="true" />
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>
