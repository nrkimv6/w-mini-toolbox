/**
 * Integration fixture tests for `_todo-2` UI 계층의 스캔↔카탈로그 흐름.
 *
 * live/browser 호출 금지(Phase T3 계약) — 모든 입력은 in-memory fixture(`SessionSummary[]`,
 * 손으로 구성한 `ScanResult`)이며, `scanWithProgress`/File System Access API는 호출하지
 * 않는다. querySessions/sortSessions(카탈로그 함수)와 isStaleScanResult/
 * resolveRescanOutcome/captureListNavSnapshot/restoreListNavSnapshot(이 child의 조합
 * 함수)를 실제 화면 흐름 순서(scan → query/sort → detail 진입 → catalog restore,
 * cancel → partial catalog → rescan diff → stale generation 차단)로 엮어 검증한다.
 */
import { describe, it, expect } from 'vitest';
import { querySessions, sortSessions } from './sessionCatalog.js';
import {
	captureListNavSnapshot,
	isStaleScanResult,
	resolveRescanOutcome,
	restoreListNavSnapshot,
	type ListNavSnapshot
} from './sessionCatalogFlow.js';
import type { ScanResult, SessionSummary } from './types.js';

function summary(overrides: Partial<SessionSummary>): SessionSummary {
	return {
		path: 'p/default.jsonl',
		subagentCount: 0,
		...overrides
	};
}

function scanResult(overrides: Partial<ScanResult>): ScanResult {
	return {
		sessions: [],
		failures: [],
		generation: 0,
		cancelled: false,
		...overrides
	};
}

describe('scan → query/sort → detail 진입 → catalog restore 흐름', () => {
	it('스캔 완료 후 검색·정렬을 거쳐 상세 진입 스냅샷을 캡처하고, 목록 복귀 시 그대로 복원한다', () => {
		// 1. 스캔 완료(초기 generation=1) — 최초 스캔이므로 isStaleScanResult는 false
		const initial = scanResult({
			generation: 1,
			sessions: [
				summary({ path: 'p1/a.jsonl', aiTitle: 'Refactor Widgets', lastTimestamp: '2026-07-20T00:00:00Z' }),
				summary({ path: 'p2/b.jsonl', aiTitle: 'Fix Login Bug', lastTimestamp: '2026-07-23T00:00:00Z' }),
				summary({ path: 'p3/c.jsonl', aiTitle: 'Widgets Cleanup', lastTimestamp: '2026-07-22T00:00:00Z' })
			]
		});
		expect(isStaleScanResult(1, initial)).toBe(false);

		const afterScan = resolveRescanOutcome([], initial);
		expect(afterScan.catalog.map((s) => s.path)).toEqual(['p1/a.jsonl', 'p2/b.jsonl', 'p3/c.jsonl']);
		// 최초 스캔은 이전 catalog가 비어있으므로 diff는 3건 모두 added
		expect(afterScan.diff).toEqual({ added: ['p1/a.jsonl', 'p2/b.jsonl', 'p3/c.jsonl'], changed: [], removed: [] });

		// 2. 목록 화면에서 검색어 'widgets'로 필터링 후 title 오름차순 정렬
		const queried = querySessions(afterScan.catalog, { text: 'widgets' });
		expect(queried.map((s) => s.path)).toEqual(['p1/a.jsonl', 'p3/c.jsonl']);
		const sorted = sortSessions(queried, 'title', 'asc');
		expect(sorted.map((s) => s.path)).toEqual(['p1/a.jsonl', 'p3/c.jsonl']); // 'Refactor...' < 'Widgets...'

		// 3. 두 번째 결과(sorted[1] = p3/c.jsonl) 상세 진입 직전 탐색 상태 스냅샷 캡처
		const snapshot = captureListNavSnapshot({
			query: 'widgets',
			sortKey: 'title',
			sortDir: 'asc',
			scrollTop: 240,
			focusedPath: sorted[1].path
		});

		// 4. 상세 화면 방문 후(이 시점에 query/sortKey/sortDir이 리셋됐다고 가정) 목록 복귀
		const fallback: ListNavSnapshot = {
			query: '',
			sortKey: 'lastActivity',
			sortDir: 'desc',
			scrollTop: 0,
			focusedPath: null
		};
		const restored = restoreListNavSnapshot(snapshot, fallback);
		expect(restored).toEqual({
			query: 'widgets',
			sortKey: 'title',
			sortDir: 'asc',
			scrollTop: 240,
			focusedPath: 'p3/c.jsonl'
		});
	});

	it('스냅샷이 없으면(목록을 거치지 않은 최초 진입) fallback을 그대로 사용한다', () => {
		const fallback: ListNavSnapshot = {
			query: '',
			sortKey: 'lastActivity',
			sortDir: 'desc',
			scrollTop: 0,
			focusedPath: null
		};
		expect(restoreListNavSnapshot(null, fallback)).toEqual(fallback);
	});
});

describe('cancel → partial catalog → rescan diff → stale generation 차단 흐름', () => {
	it('취소된 스캔은 이전 catalog를 보존하고 diff를 산출하지 않는다', () => {
		const prevCatalog: SessionSummary[] = [
			summary({ path: 'a', fileSize: 100, lastModified: 1 }),
			summary({ path: 'b', fileSize: 200, lastModified: 1 })
		];
		const cancelledResult = scanResult({
			generation: 2,
			cancelled: true,
			// 취소 시점까지 부분적으로 모은 결과(1건만 발견) — 이전 catalog보다 적어도 반영되면 안 된다
			sessions: [summary({ path: 'a', fileSize: 100, lastModified: 1 })]
		});

		const outcome = resolveRescanOutcome(prevCatalog, cancelledResult);
		expect(outcome.catalog).toEqual(prevCatalog); // 부분 결과로 덮지 않음
		expect(outcome.diff).toBeNull();
	});

	it('취소 후 재스캔이 정상 완료되면 이전 catalog 대비 diff를 산출한다', () => {
		const prevCatalog: SessionSummary[] = [
			summary({ path: 'a', fileSize: 100, lastModified: 1 }),
			summary({ path: 'b', fileSize: 200, lastModified: 1 })
		];
		const rescanResult = scanResult({
			generation: 3,
			cancelled: false,
			sessions: [
				summary({ path: 'a', fileSize: 100, lastModified: 1 }), // unchanged
				summary({ path: 'b', fileSize: 999, lastModified: 2 }), // changed
				summary({ path: 'c', fileSize: 50, lastModified: 1 }) // added
			]
		});

		const outcome = resolveRescanOutcome(prevCatalog, rescanResult);
		expect(outcome.catalog.map((s) => s.path)).toEqual(['a', 'b', 'c']);
		expect(outcome.diff).toEqual({ added: ['c'], changed: ['b'], removed: [] });
	});

	it('늦게 도착한 이전 generation 결과는 stale로 판정돼 반영에서 제외된다(역순 완료 방어)', () => {
		// 시나리오: 재스캔(generation=5)을 시작한 뒤 곧바로 취소하고 새 재스캔(generation=6)을
		// 시작했는데, 취소된 generation=5 결과가 generation=6보다 늦게 도착하는 경우.
		const latestGeneration = 6;
		const staleResult = scanResult({ generation: 5, cancelled: true, sessions: [] });
		const freshResult = scanResult({ generation: 6, cancelled: false, sessions: [summary({ path: 'fresh' })] });

		expect(isStaleScanResult(latestGeneration, staleResult)).toBe(true);
		expect(isStaleScanResult(latestGeneration, freshResult)).toBe(false);

		// UI 계층 계약: stale 결과는 catalog에 아예 반영하지 않는다(호출 자체를 건너뛴다).
		// 여기서는 그 게이트를 통과한 fresh 결과만 병합에 사용해야 함을 검증한다.
		const outcome = resolveRescanOutcome([summary({ path: 'old' })], freshResult);
		expect(outcome.catalog.map((s) => s.path)).toEqual(['fresh']);
	});
});
