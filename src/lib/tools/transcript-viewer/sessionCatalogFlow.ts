/**
 * Transcript Viewer — 스캔↔카탈로그 통합 순수 함수 (`_todo-2` UI 계층)
 *
 * `sessionScanner.ts`(스캔 실행)와 `sessionCatalog.ts`(검색/정렬/diff)를 화면
 * 상태(`+page.svelte`의 `list`/`scanning` view)에 연결할 때 필요한 조합 로직 중,
 * 브라우저 API에 의존하지 않는 부분만 이 모듈에 둔다. UI 계층(`+page.svelte`)은
 * generation 카운터 증가·`AbortController` 생성·DOM 갱신만 소유하고, "이 결과를
 * 반영해도 되는가"/"이전 catalog를 어떻게 병합하는가"는 이 모듈의 순수 함수가
 * 판정한다 — vitest만으로 stale-generation·취소·재스캔 diff 흐름을 검증하기 위함.
 */
import { diffCatalog } from './sessionCatalog.js';
import type { CatalogDiff, ScanResult, SessionSortKey, SessionSummary, SortDirection } from './types.js';

/**
 * `result`가 이미 최신이 아닌 generation에서 온 결과인지 판정한다.
 * 연속 재스캔·취소가 역순으로 완료돼도 가장 최근에 시작한 스캔(`latestGeneration`)의
 * 결과만 화면에 반영하기 위한 게이트 — 늦게 도착한 이전 generation 결과는 무시한다.
 */
export function isStaleScanResult(latestGeneration: number, result: Pick<ScanResult, 'generation'>): boolean {
	return result.generation !== latestGeneration;
}

/** 재스캔 결과를 이전 catalog에 병합한 뒤 산출 diff */
export interface RescanOutcome {
	/** 화면에 반영할 다음 catalog */
	catalog: SessionSummary[];
	/** 이전 catalog 대비 추가·변경·삭제. 취소된 스캔은 diff를 산출하지 않는다(null) */
	diff: CatalogDiff | null;
}

/**
 * 재스캔 결과를 이전 catalog와 병합한다.
 *
 * - `result.cancelled`이면 부분 결과로 완료된 catalog를 덮지 않는다 — 마지막으로
 *   완료된 catalog를 그대로 보존하고 diff는 계산하지 않는다(실패·취소 후 이전 목록
 *   유지 계약).
 * - 정상 완료(`cancelled: false`)면 `result.sessions`를 다음 catalog로 채택하고
 *   이전 catalog 대비 `diffCatalog`로 추가·변경·삭제를 산출한다.
 */
export function resolveRescanOutcome(prevCatalog: SessionSummary[], result: ScanResult): RescanOutcome {
	if (result.cancelled) {
		return { catalog: prevCatalog, diff: null };
	}
	return { catalog: result.sessions, diff: diffCatalog(prevCatalog, result.sessions) };
}

/** 목록↔상세 왕복 시 복원할 탐색 상태 스냅샷 */
export interface ListNavSnapshot {
	query: string;
	sortKey: SessionSortKey;
	sortDir: SortDirection;
	scrollTop: number;
	/** 목록에서 키보드 포커스(=선택) 대상이던 세션 경로. 없으면 null */
	focusedPath: string | null;
}

/** 현재 탐색 상태를 스냅샷으로 캡처한다(참조 분리를 위해 얕은 복사) */
export function captureListNavSnapshot(state: ListNavSnapshot): ListNavSnapshot {
	return { ...state };
}

/**
 * 상세→목록 복귀 시 스냅샷을 복원한다. 스냅샷이 없으면(목록을 거치지 않은 최초
 * 진입 등) `fallback`을 그대로 사용한다.
 */
export function restoreListNavSnapshot(
	snapshot: ListNavSnapshot | null,
	fallback: ListNavSnapshot
): ListNavSnapshot {
	return snapshot ? { ...snapshot } : { ...fallback };
}
