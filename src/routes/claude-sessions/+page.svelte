<script lang="ts">
	// Phase 4 — 페이지 통합. Phase 1~3이 만든 셸/컴포넌트를 실제 동작하는 화면으로 엮는다.
	// 재사용: transcript-viewer/parser.ts(parseTranscript)만 import — 수정 금지.
	import { tick, setContext, onMount } from 'svelte';
	import { parseTranscript } from '$lib/tools/transcript-viewer/parser.js';
	import type {
		CatalogDiff,
		ParseResult,
		RenderMessage,
		ScanFailure,
		SessionSortKey,
		SessionSummary,
		SortDirection
	} from '$lib/tools/transcript-viewer/types.js';
	import { isFileSystemAccessSupported, scanWithProgress } from '$lib/tools/transcript-viewer/sessionScanner.js';
	import { querySessions } from '$lib/tools/transcript-viewer/sessionCatalog.js';
	import {
		captureListNavSnapshot,
		isStaleScanResult,
		resolveRescanOutcome,
		restoreListNavSnapshot,
		type ListNavSnapshot
	} from '$lib/tools/transcript-viewer/sessionCatalogFlow.js';
	import { SEARCH_CONTEXT_KEY } from '$lib/tools/transcript-viewer/search.js';
	import {
		isIndexedDbSupported,
		createIndexedDbStore,
		openLocalRepository,
		resetLocalRepository,
		readFavorites,
		addFavorite,
		removeFavorite,
		resolveFavoriteKey,
		readRecentFolders,
		upsertRecentFolder,
		removeRecentFolder,
		clearRecentFolders,
		verifyRecentFolderPermission,
		type FavoriteEntry,
		type RecentFolderEntry,
		type LocalRepositoryError,
		type LocalRepositoryStore
	} from '$lib/tools/transcript-viewer/localRepository.js';
	import EntryPanel from '$lib/tools/claude-sessions/components/EntryPanel.svelte';
	import PrivacyNotice from '$lib/tools/claude-sessions/components/PrivacyNotice.svelte';
	import MetaBar from '$lib/tools/claude-sessions/components/MetaBar.svelte';
	import FilterControls from '$lib/tools/claude-sessions/components/FilterControls.svelte';
	import DetailToolbar from '$lib/tools/claude-sessions/components/DetailToolbar.svelte';
	import SearchBar from '$lib/tools/claude-sessions/components/SearchBar.svelte';
	import MessageBlock from '$lib/tools/claude-sessions/components/MessageBlock.svelte';
	import SessionList from '$lib/tools/claude-sessions/components/SessionList.svelte';
	import ScanStatus from '$lib/tools/claude-sessions/components/ScanStatus.svelte';
	import { buildMatchIndex, stepMatch, clampCurrent, type DetailSearchContext } from '$lib/tools/claude-sessions/searchNav.js';
	import { FileWarning, FolderOpen, RotateCcw, Search as SearchIcon, ShieldAlert, Trash2, X } from 'lucide-svelte';

	/**
	 * personalization Phase 2 — `FileSystemDirectoryHandle.requestPermission`은 이 프로젝트의
	 * TypeScript `lib.dom.d.ts` 번들에 아직 포함되지 않아 로컬로 보강한다(sessionScanner.ts의
	 * `values()`/`showDirectoryPicker` 보강과 동일한 사유). `queryPermission` 보강은
	 * localRepository.ts가 이미 소유한다 — 여기서는 재승인(request) 쪽만 추가한다.
	 */
	declare global {
		interface FileSystemDirectoryHandle {
			requestPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
		}
	}

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

	// _todo-2 Phase 1/3 — 스캔 진행/취소/generation 격리 + 재스캔 diff.
	// `rootHandle`은 "다시 스캔"/"다시 시도"가 같은 폴더를 재사용하기 위한 참조,
	// `scanGeneration`은 매 스캔 시작마다 증가하는 식별자로 늦게 도착한 이전 스캔 결과를
	// `isStaleScanResult`가 무시할 수 있게 한다(연속 재스캔·취소가 역순으로 끝나도 안전).
	let rootHandle: FileSystemDirectoryHandle | null = null;
	let scanGeneration = $state(0);
	let scanAbort: AbortController | null = null;
	let rescanning = $state(false);
	let scanScanned = $state(0);
	let scanCurrentPath = $state<string | undefined>(undefined);
	let scanCancelledFlag = $state(false);
	let scanFailures = $state<ScanFailure[]>([]);
	let catalogDiff = $state<CatalogDiff | null>(null);

	// _todo-2 Phase 2 — 목록 검색/정렬 상태. `querySessions`는 여기서 호출해 SessionList에
	// 이미 필터된 목록을 넘기고(page 소유), 정렬(`sortSessions`)은 SessionList가 소유한다
	// (SessionList.svelte 상단 주석 참조).
	let searchQuery = $state('');
	let sortKey = $state<SessionSortKey>('lastActivity');
	let sortDir = $state<SortDirection>('desc');
	let listFocusedPath = $state<string | null>(null);

	const DEFAULT_SORT_KEY: SessionSortKey = 'lastActivity';
	const DEFAULT_SORT_DIR: SortDirection = 'desc';

	// personalization Phase 2 — 로컬 전용 개인화(즐겨찾기·최근 폴더) 상태. transcript 본문은
	// 저장하지 않는다(localRepository.ts 계약). `localRepoStatus`는 초기화·오류·미지원을
	// 구분해 entry 화면에 노출한다(계획서 item 3).
	let localStore = $state<LocalRepositoryStore | null>(null);
	let localRepoStatus = $state<'loading' | 'ready' | 'unsupported' | 'error'>('loading');
	let localRepoError = $state<LocalRepositoryError | null>(null);
	let favorites = $state<FavoriteEntry[]>([]);
	let recentFolders = $state<RecentFolderEntry[]>([]);
	let recentFolderPermission = $state<Record<string, 'checking' | 'granted' | 'expired' | 'unknown'>>({});
	let recentFolderActionError = $state<string | null>(null);

	/** 이번 스캔에서 발견된 전체 세션 키(검색어 무관) — SessionList의 유실 즐겨찾기 판정용 */
	const allSessionKeys = $derived(new Set(sessions.map((s) => resolveFavoriteKey(s))));

	async function reloadLocalRepositoryData() {
		if (!localStore) return;
		const favResult = await readFavorites(localStore);
		if (favResult.ok) favorites = favResult.value;
		const recentResult = await readRecentFolders(localStore);
		if (recentResult.ok) {
			recentFolders = recentResult.value;
			await refreshRecentFolderPermissions(recentFolders);
		}
	}

	/** 저장된 최근 폴더 핸들의 읽기 권한을 조용히(프롬프트 없이) 확인해 배지 상태를 채운다 */
	async function refreshRecentFolderPermissions(entries: RecentFolderEntry[]) {
		const next: Record<string, 'checking' | 'granted' | 'expired' | 'unknown'> = {};
		for (const entry of entries) {
			const result = await verifyRecentFolderPermission(entry.handle);
			next[entry.id] = result.ok ? 'granted' : result.error.kind === 'permission-expired' ? 'expired' : 'unknown';
		}
		recentFolderPermission = next;
	}

	/** entry 화면 진입 시 1회 로컬 저장소를 연다. 알 수 없는 schema version은 열지 않고 오류로 남긴다 */
	async function initLocalRepository() {
		if (!isIndexedDbSupported()) {
			localRepoStatus = 'unsupported';
			return;
		}
		try {
			const store = await createIndexedDbStore();
			const opened = await openLocalRepository(store);
			localStore = store;
			if (!opened.ok) {
				localRepoError = opened.error;
				localRepoStatus = 'error';
				return;
			}
			localRepoStatus = 'ready';
			localRepoError = null;
			await reloadLocalRepositoryData();
		} catch (err) {
			localRepoError = { kind: 'unknown', message: err instanceof Error ? err.message : String(err) };
			localRepoStatus = 'error';
		}
	}

	/** 초기화 action(알 수 없는 schema version 복구) — 전체를 비우고 현재 버전으로 재기록한다 */
	async function resetLocalRepo() {
		if (!localStore) return;
		const result = await resetLocalRepository(localStore);
		if (result.ok) {
			localRepoError = null;
			localRepoStatus = 'ready';
			favorites = [];
			recentFolders = [];
			recentFolderPermission = {};
		} else {
			localRepoError = result.error;
		}
	}

	/** 저장소 연결 재시도(오류 배너의 "다시 시도") */
	async function retryLocalRepository() {
		localRepoStatus = 'loading';
		await initLocalRepository();
	}

	/** 세션 목록 즐겨찾기 표시/해제 토글 — SessionList가 세션 단위로 호출한다 */
	async function toggleFavorite(session: SessionSummary) {
		if (!localStore) return;
		const key = resolveFavoriteKey(session);
		const isFav = favorites.some((f) => f.sessionKey === key);
		const result = isFav ? await removeFavorite(localStore, key) : await addFavorite(localStore, session);
		if (result.ok) {
			await reloadLocalRepositoryData();
		} else {
			localRepoError = result.error;
			localRepoStatus = 'error';
		}
	}

	/** 유실된(현재 스캔에 없는) 즐겨찾기 1건 삭제 */
	async function removeOrphanedFavorite(sessionKey: string) {
		if (!localStore) return;
		const result = await removeFavorite(localStore, sessionKey);
		if (result.ok) await reloadLocalRepositoryData();
	}

	/** "YYYY-MM-DD HH:mm" 축약(로케일 비의존, SessionListItem.shortTimestamp와 동일 패턴) */
	function formatRecentFolderTimestamp(iso: string): string {
		return iso.slice(0, 16).replace('T', ' ');
	}

	/** 최근 폴더 "다시 열기" — 이미 granted로 확인된 핸들만 이 버튼을 노출한다(마크업 조건) */
	async function reopenRecentFolder(entry: RecentFolderEntry) {
		recentFolderActionError = null;
		fromList = false;
		await runScan(entry.handle);
	}

	/** 최근 폴더 "권한 재승인" — `requestPermission`으로 사용자에게 재승인을 요청한 뒤 재스캔한다 */
	async function reauthorizeRecentFolder(entry: RecentFolderEntry) {
		recentFolderActionError = null;
		if (!entry.handle.requestPermission) {
			recentFolderActionError = '이 브라우저는 권한 재요청을 지원하지 않습니다. 폴더를 다시 선택해 주세요.';
			return;
		}
		try {
			const state = await entry.handle.requestPermission({ mode: 'read' });
			if (state !== 'granted') {
				recentFolderPermission = { ...recentFolderPermission, [entry.id]: 'expired' };
				return;
			}
			recentFolderPermission = { ...recentFolderPermission, [entry.id]: 'granted' };
			fromList = false;
			await runScan(entry.handle);
		} catch (err) {
			recentFolderActionError = err instanceof Error ? err.message : String(err);
		}
	}

	/** 최근 폴더 기록 1건 삭제(핸들 자체나 즐겨찾기에는 영향 없음) */
	async function deleteRecentFolderEntry(id: string) {
		if (!localStore) return;
		const result = await removeRecentFolder(localStore, id);
		if (result.ok) {
			recentFolders = recentFolders.filter((f) => f.id !== id);
			const { [id]: _removed, ...rest } = recentFolderPermission;
			recentFolderPermission = rest;
		}
	}

	/** 최근 폴더 기록 전체 삭제(즐겨찾기는 유지 — localRepository.clearRecentFolders 계약) */
	async function clearAllRecentFolders() {
		if (!localStore) return;
		const result = await clearRecentFolders(localStore);
		if (result.ok) {
			recentFolders = [];
			recentFolderPermission = {};
		}
	}

	onMount(() => {
		initLocalRepository();
	});

	const filteredSessions = $derived(querySessions(sessions, { text: searchQuery }));
	const listFiltersActive = $derived(
		searchQuery.trim().length > 0 || sortKey !== DEFAULT_SORT_KEY || sortDir !== DEFAULT_SORT_DIR
	);

	function clearListFilters() {
		searchQuery = '';
		sortKey = DEFAULT_SORT_KEY;
		sortDir = DEFAULT_SORT_DIR;
	}

	// _todo-2 Phase 3 — 목록→상세→목록 왕복 시 복원할 스냅샷(검색어/정렬/스크롤/포커스).
	// `openFromList`에서 캡처하고 `backToList`에서 복원한다. 목록을 거치지 않고 최초
	// 진입한 경우(`fromList=false`)에는 캡처가 없으므로 복원도 일어나지 않는다.
	let listNavSnapshot: ListNavSnapshot | null = null;

	// _todo-2 Phase 4 — 상태 전환 시(스캔 완료/재스캔 완료) 초점을 목록 영역으로 이동한다.
	// `sr-only`로 시각적으로는 숨기되 스크린리더/키보드 사용자가 전환을 인지할 수 있는
	// 초점 대상을 둔다(가시 UI를 새로 추가하지 않기 위해 검색 입력 대신 별도 heading 사용).
	let listHeadingEl = $state<HTMLHeadingElement | undefined>(undefined);
	$effect(() => {
		if (view.kind === 'list' && !rescanning) {
			tick().then(() => listHeadingEl?.focus());
		}
	});

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

	// _todo-2 Phase 1/3 — 스캔 실행 공통 경로. `openFolder`(최초 진입)와 `retryScan`/
	// "다시 스캔"(list 화면에서 재스캔)이 공유한다. 이전 in-flight 스캔이 있으면 먼저
	// abort하고(늦은 완료가 새 상태를 덮지 않도록 generation도 함께 올린다), 완료 시
	// `isStaleScanResult`로 자신이 여전히 최신 스캔인지 확인한 뒤에만 상태를 반영한다.
	async function runScan(handle: FileSystemDirectoryHandle) {
		rootHandle = handle;
		scanAbort?.abort();
		const controller = new AbortController();
		scanAbort = controller;
		const generation = ++scanGeneration;

		scanScanned = 0;
		scanCurrentPath = undefined;
		scanFailures = [];
		catalogDiff = null;
		if (view.kind !== 'list') {
			view = { kind: 'scanning' };
		} else {
			rescanning = true;
		}

		const result = await scanWithProgress(handle, {
			generation,
			signal: controller.signal,
			onProgress: (p) => {
				if (generation !== scanGeneration) return;
				scanScanned = p.scanned;
				scanCurrentPath = p.currentPath;
			}
		});

		if (isStaleScanResult(scanGeneration, result)) return;

		const outcome = resolveRescanOutcome(sessions, result);
		sessions = outcome.catalog;
		catalogDiff = outcome.diff;
		scanFailures = result.failures;
		scanCancelledFlag = result.cancelled;
		scanScanned = result.sessions.length + result.failures.length;
		rescanning = false;
		view = { kind: 'list' };

		// personalization Phase 2 — 폴더 핸들 재사용은 scanClaudeProjectsDirectory 계열
		// 진입점(runScan이 감싸는 scanWithProgress)을 그대로 재호출하는 방식으로 이뤄지고,
		// 이 스캔이 성공한 시점에 최근 폴더 기록을 갱신한다(스캔 로직 자체는 신규 작성 없음).
		if (localStore && !result.cancelled) {
			const recentEntry: RecentFolderEntry = {
				id: handle.name,
				name: handle.name,
				handle,
				lastOpenedAt: new Date().toISOString(),
				sessionCount: sessions.length
			};
			const upserted = await upsertRecentFolder(localStore, recentEntry);
			if (upserted.ok) {
				recentFolders = upserted.value;
				recentFolderPermission = { ...recentFolderPermission, [handle.name]: 'granted' };
			}
		}
	}

	/** Phase 1 — 진행 중인 스캔 취소. `scanWithProgress`가 지금까지의 부분 결과를 반환한다 */
	function cancelScan() {
		scanAbort?.abort();
	}

	/** Phase 1/3 — 마지막으로 연 폴더를 다시 스캔한다("다시 시도"/"다시 스캔" 공용) */
	function retryScan() {
		if (rootHandle) runScan(rootHandle);
	}

	// item 10(재타겟) — "폴더 열기" 진입점. `showDirectoryPicker()` → 스캔 → `list` 전환.
	// picker 취소(`AbortError`)는 조용히 무시한다(item 10 요구사항).
	async function openFolder() {
		if (!window.showDirectoryPicker) return;
		try {
			const handle = await window.showDirectoryPicker();
			fromList = false;
			await runScan(handle);
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') {
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
	// _todo-2 Phase 3 — 상세 진입 직전 탐색 상태(검색어/정렬/스크롤/포커스)를 스냅샷으로
	// 캡처한다. `backToList`가 이 스냅샷으로 복원한다.
	async function openFromList(path: string) {
		const session = sessions.find((s) => s.path === path);
		if (!session?.fileHandle) return;

		listNavSnapshot = captureListNavSnapshot({
			query: searchQuery,
			sortKey,
			sortDir,
			scrollTop: typeof window !== 'undefined' ? window.scrollY : 0,
			focusedPath: path
		});

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

	/**
	 * item 12(재타겟) — 목록 경유로 진입한 상세 뷰에서 목록으로 되돌아간다.
	 * _todo-2 Phase 3 — `openFromList`가 남긴 스냅샷으로 검색어·정렬·포커스를 복원하고,
	 * 목록이 다시 렌더된 뒤(tick) 스크롤 위치를 복원한다.
	 */
	function backToList() {
		const fallback: ListNavSnapshot = {
			query: searchQuery,
			sortKey,
			sortDir,
			scrollTop: 0,
			focusedPath: null
		};
		const restored = restoreListNavSnapshot(listNavSnapshot, fallback);
		searchQuery = restored.query;
		sortKey = restored.sortKey;
		sortDir = restored.sortDir;
		listFocusedPath = restored.focusedPath;
		view = { kind: 'list' };
		tick().then(() => {
			if (typeof window !== 'undefined') window.scrollTo(0, restored.scrollTop);
		});
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
			<div class="flex flex-col gap-6">
				<EntryPanel
					onFilePicked={openFile}
					{readError}
					onOpenFolder={openFolder}
					folderSupported={isFileSystemAccessSupported()}
				/>

				<!-- personalization Phase 2 — 최근 폴더 + 로컬 저장소 초기화/오류/재시도.
				     PrivacyNotice(로컬·읽기 전용 pill)는 이미 wrapper 최상단에서 모든 상태에
				     걸쳐 노출되므로(위 배치 계약), 여기서는 즐겨찾기·최근 폴더가 "그 안"의
				     저장소(IndexedDB)를 쓴다는 점만 짧게 덧붙인다. -->
				{#if localRepoStatus === 'unsupported'}
					<div
						role="status"
						aria-live="polite"
						class="flex items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-xs text-muted-foreground"
					>
						<ShieldAlert class="size-3.5 shrink-0" aria-hidden="true" />
						<span>이 브라우저는 로컬 저장소(IndexedDB)를 지원하지 않아 즐겨찾기·최근 폴더를 쓸 수 없습니다.</span>
					</div>
				{:else if localRepoStatus === 'error'}
					<div
						role="alert"
						class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-xs text-destructive"
					>
						<span>
							{#if localRepoError?.kind === 'unknown-schema-version'}
								알 수 없는 로컬 저장소 버전입니다{#if localRepoError?.storedVersion !== undefined}
									(저장된 버전: {localRepoError.storedVersion}){/if}. 즐겨찾기·최근 폴더를 읽을 수 없습니다.
							{:else}
								로컬 저장소 오류: {localRepoError?.message ?? '알 수 없는 오류'}
							{/if}
						</span>
						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={retryLocalRepository}
								class="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-background px-3 py-1 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring/40"
							>
								<RotateCcw class="size-3" aria-hidden="true" />
								다시 시도
							</button>
							<button
								type="button"
								onclick={resetLocalRepo}
								class="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-background px-3 py-1 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring/40"
							>
								<Trash2 class="size-3" aria-hidden="true" />
								로컬 저장소 초기화
							</button>
						</div>
					</div>
				{/if}

				{#if recentFolderActionError}
					<div
						role="alert"
						class="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-xs text-destructive"
					>
						<span>{recentFolderActionError}</span>
						<button
							type="button"
							onclick={() => (recentFolderActionError = null)}
							aria-label="오류 알림 닫기"
							class="text-destructive hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring/40"
						>
							<X class="size-3.5" aria-hidden="true" />
						</button>
					</div>
				{/if}

				{#if recentFolders.length > 0}
					<section aria-label="최근 폴더" class="rounded-xl border border-border bg-surface p-4">
						<div class="mb-3 flex items-center justify-between gap-2">
							<h2 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">최근 폴더</h2>
							<button
								type="button"
								onclick={clearAllRecentFolders}
								class="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
							>
								<Trash2 class="size-3" aria-hidden="true" />
								전체 기록 삭제
							</button>
						</div>
						<ul class="flex flex-col gap-2">
							{#each recentFolders as folder (folder.id)}
								<li class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
									<div class="flex min-w-0 flex-col gap-0.5">
										<span class="truncate text-sm font-medium text-foreground">{folder.name}</span>
										<span class="font-mono text-[10px] text-muted-foreground">
											{formatRecentFolderTimestamp(folder.lastOpenedAt)} · 세션 {folder.sessionCount ?? '?'}개
										</span>
									</div>
									<div class="flex shrink-0 items-center gap-1.5">
										{#if recentFolderPermission[folder.id] === 'expired' || recentFolderPermission[folder.id] === 'unknown'}
											<span class="text-[10px] font-medium text-warning-foreground">권한 만료</span>
											<button
												type="button"
												onclick={() => reauthorizeRecentFolder(folder)}
												class="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40"
											>
												권한 재승인
											</button>
										{:else}
											<button
												type="button"
												onclick={() => reopenRecentFolder(folder)}
												class="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40"
											>
												<FolderOpen class="size-3" aria-hidden="true" />
												다시 열기
											</button>
										{/if}
										<button
											type="button"
											onclick={() => deleteRecentFolderEntry(folder.id)}
											aria-label={`${folder.name} 최근 폴더 기록 삭제`}
											class="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
										>
											<Trash2 class="size-3.5" aria-hidden="true" />
										</button>
									</div>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			</div>
		{:else if view.kind === 'scanning'}
			<!-- item 10(재타겟) — 폴더 스캔 중 상태. _todo-2 Phase 1 — 진행 수치 + 취소 action -->
			<ScanStatus scanning={true} scanned={scanScanned} currentPath={scanCurrentPath} onCancel={cancelScan} />
		{:else if view.kind === 'list'}
			<!-- item 8~9(재타겟) — 세션 목록. _todo-2 Phase 1/3 — 재스캔 진행/취소/복구 상태 -->
			<div class="flex flex-col gap-4">
				<h2 bind:this={listHeadingEl} tabindex="-1" class="sr-only focus:outline-none">
					세션 목록 — {sessions.length}개
				</h2>
				{#if rescanning}
					<ScanStatus scanning={true} scanned={scanScanned} currentPath={scanCurrentPath} onCancel={cancelScan} />
				{:else}
					<ScanStatus
						scanning={false}
						scanned={scanScanned}
						cancelled={scanCancelledFlag}
						failures={scanFailures}
						onRetry={retryScan}
						onChooseAnotherFolder={openFolder}
					/>
				{/if}

				{#if catalogDiff && (catalogDiff.added.length > 0 || catalogDiff.changed.length > 0 || catalogDiff.removed.length > 0)}
					<!-- _todo-2 Phase 3 — 재스캔 diff 요약 -->
					<div
						role="status"
						aria-live="polite"
						class="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-2 text-xs text-muted-foreground"
					>
						<span>
							재스캔 결과: 추가 {catalogDiff.added.length}건, 변경 {catalogDiff.changed.length}건, 삭제
							{catalogDiff.removed.length}건
						</span>
						<button
							type="button"
							onclick={() => (catalogDiff = null)}
							aria-label="재스캔 결과 알림 닫기"
							class="text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
						>
							<X class="size-3.5" aria-hidden="true" />
						</button>
					</div>
				{/if}

				<!-- _todo-2 Phase 2 — 검색·정렬 컨트롤 -->
				<div class="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3">
					<div class="relative min-w-[14rem] flex-1">
						<SearchIcon
							class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<input
							type="text"
							bind:value={searchQuery}
							aria-label="세션 목록 검색"
							placeholder="제목, 프로젝트, 브랜치, 세션 ID 검색…"
							class="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
						/>
					</div>

					<label class="flex items-center gap-1.5 text-xs text-muted-foreground">
						정렬
						<select
							bind:value={sortKey}
							class="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
						>
							<option value="lastActivity">최근 활동</option>
							<option value="title">제목</option>
							<option value="messageCount">서브에이전트 수</option>
						</select>
					</label>

					<button
						type="button"
						onclick={() => (sortDir = sortDir === 'desc' ? 'asc' : 'desc')}
						aria-label={sortDir === 'desc' ? '내림차순 정렬 중 — 오름차순으로 전환' : '오름차순 정렬 중 — 내림차순으로 전환'}
						class="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40"
					>
						{sortDir === 'desc' ? '내림차순' : '오름차순'}
					</button>

					<span class="font-mono text-[10px] tabular-nums text-muted-foreground" aria-live="polite">
						{filteredSessions.length} / {sessions.length}
					</span>

					{#if listFiltersActive}
						<button
							type="button"
							onclick={clearListFilters}
							class="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
						>
							<RotateCcw class="size-3" aria-hidden="true" />
							조건 해제
						</button>
					{/if}
				</div>

				<SessionList
					sessions={filteredSessions}
					{sortKey}
					{sortDir}
					bind:focusedPath={listFocusedPath}
					onselect={openFromList}
					{favorites}
					{allSessionKeys}
					onToggleFavorite={toggleFavorite}
					onRemoveOrphanedFavorite={removeOrphanedFavorite}
				/>
			</div>
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
