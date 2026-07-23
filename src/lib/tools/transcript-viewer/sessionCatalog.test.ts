/**
 * Unit Tests for Transcript Viewer session catalog pure functions
 */
import { describe, it, expect } from 'vitest';
import { querySessions, sortSessions, diffCatalog } from './sessionCatalog.js';
import type { SessionSummary } from './types.js';

function summary(overrides: Partial<SessionSummary>): SessionSummary {
	return {
		path: 'p/default.jsonl',
		subagentCount: 0,
		...overrides
	};
}

describe('querySessions', () => {
	const sessions: SessionSummary[] = [
		summary({ path: 'p1/a.jsonl', aiTitle: 'Refactor Widgets', cwd: '/repo/widget-app' }),
		summary({ path: 'p2/b.jsonl', gitBranch: 'feature/login', sessionId: 'sess-xyz' }),
		summary({ path: 'p3/c.jsonl', aiTitle: '아무 관련 없음', cwd: '/repo/other' })
	];

	it('query.text가 없으면 전체를 그대로 반환한다', () => {
		expect(querySessions(sessions, {})).toEqual(sessions);
	});

	it('aiTitle 부분일치(대소문자 무시)로 필터링한다', () => {
		const result = querySessions(sessions, { text: 'widgets' });
		expect(result.map((s) => s.path)).toEqual(['p1/a.jsonl']);
	});

	it('cwd/gitBranch/sessionId 등 다중 필드에서 매칭한다', () => {
		expect(querySessions(sessions, { text: 'widget-app' }).map((s) => s.path)).toEqual(['p1/a.jsonl']);
		expect(querySessions(sessions, { text: 'feature/login' }).map((s) => s.path)).toEqual(['p2/b.jsonl']);
		expect(querySessions(sessions, { text: 'sess-xyz' }).map((s) => s.path)).toEqual(['p2/b.jsonl']);
	});

	it('여러 조건에 매칭되는 세션이 없으면 빈 배열을 반환한다', () => {
		expect(querySessions(sessions, { text: 'no-such-term' })).toEqual([]);
	});
});

describe('sortSessions', () => {
	it('lastActivity 기준 내림차순 정렬한다', () => {
		const sessions: SessionSummary[] = [
			summary({ path: 'a', lastTimestamp: '2026-07-20T00:00:00Z' }),
			summary({ path: 'b', lastTimestamp: '2026-07-23T00:00:00Z' }),
			summary({ path: 'c', lastTimestamp: '2026-07-21T00:00:00Z' })
		];
		const result = sortSessions(sessions, 'lastActivity', 'desc');
		expect(result.map((s) => s.path)).toEqual(['b', 'c', 'a']);
	});

	it('lastActivity 오름차순 정렬한다', () => {
		const sessions: SessionSummary[] = [
			summary({ path: 'a', lastTimestamp: '2026-07-20T00:00:00Z' }),
			summary({ path: 'b', lastTimestamp: '2026-07-23T00:00:00Z' })
		];
		const result = sortSessions(sessions, 'lastActivity', 'asc');
		expect(result.map((s) => s.path)).toEqual(['a', 'b']);
	});

	it('종료 시각(lastTimestamp)이 없는 세션은 firstTimestamp로 fallback 정렬한다', () => {
		const sessions: SessionSummary[] = [
			summary({ path: 'a', firstTimestamp: '2026-07-22T00:00:00Z' }),
			summary({ path: 'b', lastTimestamp: '2026-07-23T00:00:00Z' })
		];
		const result = sortSessions(sessions, 'lastActivity', 'desc');
		expect(result.map((s) => s.path)).toEqual(['b', 'a']);
	});

	it('비교 값이 둘 다 없는 세션은 방향과 무관하게 목록 끝으로 밀린다', () => {
		const sessions: SessionSummary[] = [
			summary({ path: 'no-timestamp' }),
			summary({ path: 'has-timestamp', lastTimestamp: '2026-07-23T00:00:00Z' })
		];
		expect(sortSessions(sessions, 'lastActivity', 'asc').map((s) => s.path)).toEqual([
			'has-timestamp',
			'no-timestamp'
		]);
		expect(sortSessions(sessions, 'lastActivity', 'desc').map((s) => s.path)).toEqual([
			'has-timestamp',
			'no-timestamp'
		]);
	});

	it('동일 시각(tie)이면 입력 순서를 유지한다(stable)', () => {
		const sessions: SessionSummary[] = [
			summary({ path: 'first', lastTimestamp: '2026-07-23T00:00:00Z' }),
			summary({ path: 'second', lastTimestamp: '2026-07-23T00:00:00Z' })
		];
		expect(sortSessions(sessions, 'lastActivity', 'desc').map((s) => s.path)).toEqual(['first', 'second']);
	});

	it('title 기준 오름차순 정렬한다(대소문자 무시)', () => {
		const sessions: SessionSummary[] = [
			summary({ path: 'a', aiTitle: 'Zebra' }),
			summary({ path: 'b', aiTitle: 'apple' }),
			summary({ path: 'c', aiTitle: 'Mango' })
		];
		const result = sortSessions(sessions, 'title', 'asc');
		expect(result.map((s) => s.path)).toEqual(['b', 'c', 'a']);
	});

	it('messageCount 기준 내림차순 정렬한다', () => {
		const sessions: SessionSummary[] = [
			summary({ path: 'a', subagentCount: 1 }),
			summary({ path: 'b', subagentCount: 5 }),
			summary({ path: 'c', subagentCount: 3 })
		];
		const result = sortSessions(sessions, 'messageCount', 'desc');
		expect(result.map((s) => s.path)).toEqual(['b', 'c', 'a']);
	});
});

describe('diffCatalog', () => {
	it('새로 추가된 경로를 added에 담는다', () => {
		const prev: SessionSummary[] = [summary({ path: 'a', fileSize: 100 })];
		const next: SessionSummary[] = [summary({ path: 'a', fileSize: 100 }), summary({ path: 'b', fileSize: 200 })];
		expect(diffCatalog(prev, next)).toEqual({ added: ['b'], changed: [], removed: [] });
	});

	it('fileSize/lastModified fingerprint가 달라진 경로를 changed에 담는다', () => {
		const prev: SessionSummary[] = [summary({ path: 'a', fileSize: 100, lastModified: 1000 })];
		const next: SessionSummary[] = [summary({ path: 'a', fileSize: 150, lastModified: 1000 })];
		expect(diffCatalog(prev, next)).toEqual({ added: [], changed: ['a'], removed: [] });
	});

	it('사라진 경로를 removed에 담는다', () => {
		const prev: SessionSummary[] = [summary({ path: 'a' }), summary({ path: 'b' })];
		const next: SessionSummary[] = [summary({ path: 'a' })];
		expect(diffCatalog(prev, next)).toEqual({ added: [], changed: [], removed: ['b'] });
	});

	it('fingerprint가 동일하면 changed에 담지 않는다', () => {
		const prev: SessionSummary[] = [summary({ path: 'a', fileSize: 100, lastModified: 1000 })];
		const next: SessionSummary[] = [summary({ path: 'a', fileSize: 100, lastModified: 1000 })];
		expect(diffCatalog(prev, next)).toEqual({ added: [], changed: [], removed: [] });
	});

	it('추가·변경·삭제가 동시에 발생해도 각각 정확히 분류한다', () => {
		const prev: SessionSummary[] = [
			summary({ path: 'keep', fileSize: 10, lastModified: 1 }),
			summary({ path: 'change-me', fileSize: 10, lastModified: 1 }),
			summary({ path: 'gone', fileSize: 10, lastModified: 1 })
		];
		const next: SessionSummary[] = [
			summary({ path: 'keep', fileSize: 10, lastModified: 1 }),
			summary({ path: 'change-me', fileSize: 20, lastModified: 2 }),
			summary({ path: 'new', fileSize: 30, lastModified: 3 })
		];
		expect(diffCatalog(prev, next)).toEqual({ added: ['new'], changed: ['change-me'], removed: ['gone'] });
	});
});
