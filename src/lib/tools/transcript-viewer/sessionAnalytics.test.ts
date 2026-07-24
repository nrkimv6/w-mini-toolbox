/**
 * Unit Tests for Transcript Viewer sessionAnalytics(비교/집계 순수 함수)
 */
import { describe, it, expect } from 'vitest';
import {
	compareSessionMetrics,
	extractMetricValue,
	aggregateSessionsByProject,
	type SessionAnalyticsInput
} from './sessionAnalytics.js';
import type { TranscriptMeta } from './types.js';

function meta(overrides: Partial<TranscriptMeta> = {}): TranscriptMeta {
	return {
		models: ['claude-opus'],
		totalMessages: 10,
		totalInputTokens: 100,
		totalOutputTokens: 200,
		totalCacheCreationTokens: 0,
		totalCacheReadTokens: 0,
		...overrides
	};
}

function session(overrides: Partial<SessionAnalyticsInput> = {}): SessionAnalyticsInput {
	return {
		path: 'p/default.jsonl',
		subagentCount: 0,
		...overrides
	};
}

describe('extractMetricValue', () => {
	it('meta가 없으면 토큰/메시지 지표는 null(누락)을 반환한다', () => {
		const s = session();
		expect(extractMetricValue(s, 'totalMessages')).toBeNull();
		expect(extractMetricValue(s, 'totalInputTokens')).toBeNull();
		expect(extractMetricValue(s, 'totalCacheTokens')).toBeNull();
	});

	it('totalCacheTokens는 cache_creation + cache_read 합이다', () => {
		const s = session({ meta: meta({ totalCacheCreationTokens: 5, totalCacheReadTokens: 7 }) });
		expect(extractMetricValue(s, 'totalCacheTokens')).toBe(12);
	});

	it('durationMs는 first~last timestamp 차이다', () => {
		const s = session({ firstTimestamp: '2026-07-23T00:00:00Z', lastTimestamp: '2026-07-23T00:10:00Z' });
		expect(extractMetricValue(s, 'durationMs')).toBe(10 * 60 * 1000);
	});

	it('timestamp가 하나라도 없으면 durationMs는 null이다', () => {
		expect(extractMetricValue(session({ firstTimestamp: '2026-07-23T00:00:00Z' }), 'durationMs')).toBeNull();
	});

	it('0값(totalMessages=0)은 유효 값으로 취급한다(null이 아님)', () => {
		const s = session({ meta: meta({ totalMessages: 0 }) });
		expect(extractMetricValue(s, 'totalMessages')).toBe(0);
	});

	it('subagentCount는 SessionSummary 필드를 그대로 사용한다(meta 무관)', () => {
		expect(extractMetricValue(session({ subagentCount: 3 }), 'subagentCount')).toBe(3);
	});
});

describe('compareSessionMetrics', () => {
	it('2개 이상 세션을 비교해 min/max/delta를 계산한다', () => {
		const sessions = [
			session({ path: 'a', meta: meta({ totalMessages: 10 }) }),
			session({ path: 'b', meta: meta({ totalMessages: 30 }) }),
			session({ path: 'c', meta: meta({ totalMessages: 20 }) })
		];
		const [cmp] = compareSessionMetrics(sessions, ['totalMessages']);
		expect(cmp.min).toEqual({ path: 'a', value: 10 });
		expect(cmp.max).toEqual({ path: 'b', value: 30 });
		expect(cmp.delta).toBe(20);
		expect(cmp.values.map((v) => v.value)).toEqual([10, 30, 20]);
	});

	it('누락값(meta 없음)이 섞여도 유효 값만으로 min/max를 계산한다', () => {
		const sessions = [
			session({ path: 'a', meta: meta({ totalMessages: 10 }) }),
			session({ path: 'b' }), // meta 없음 → null
			session({ path: 'c', meta: meta({ totalMessages: 20 }) })
		];
		const [cmp] = compareSessionMetrics(sessions, ['totalMessages']);
		expect(cmp.values.map((v) => v.value)).toEqual([10, null, 20]);
		expect(cmp.min).toEqual({ path: 'a', value: 10 });
		expect(cmp.max).toEqual({ path: 'c', value: 20 });
		expect(cmp.delta).toBe(10);
	});

	it('유효 값이 1개 이하면 delta는 null(비교 불가)이다', () => {
		const sessions = [session({ path: 'a', meta: meta({ totalMessages: 10 }) }), session({ path: 'b' })];
		const [cmp] = compareSessionMetrics(sessions, ['totalMessages']);
		expect(cmp.delta).toBeNull();
		expect(cmp.min).toEqual({ path: 'a', value: 10 });
		expect(cmp.max).toEqual({ path: 'a', value: 10 });
	});

	it('유효 값이 하나도 없으면 min/max/delta 모두 null이다', () => {
		const sessions = [session({ path: 'a' }), session({ path: 'b' })];
		const [cmp] = compareSessionMetrics(sessions, ['totalMessages']);
		expect(cmp.min).toBeNull();
		expect(cmp.max).toBeNull();
		expect(cmp.delta).toBeNull();
	});

	it('0값을 포함해도 min이 0으로 정확히 잡힌다', () => {
		const sessions = [
			session({ path: 'a', meta: meta({ totalMessages: 0 }) }),
			session({ path: 'b', meta: meta({ totalMessages: 5 }) })
		];
		const [cmp] = compareSessionMetrics(sessions, ['totalMessages']);
		expect(cmp.min).toEqual({ path: 'a', value: 0 });
		expect(cmp.delta).toBe(5);
	});

	it('여러 지표를 동시에 비교한다', () => {
		const sessions = [
			session({ path: 'a', meta: meta({ totalMessages: 10, totalInputTokens: 100 }) }),
			session({ path: 'b', meta: meta({ totalMessages: 20, totalInputTokens: 50 }) })
		];
		const result = compareSessionMetrics(sessions, ['totalMessages', 'totalInputTokens']);
		expect(result).toHaveLength(2);
		expect(result[0].metric).toBe('totalMessages');
		expect(result[1].metric).toBe('totalInputTokens');
		expect(result[1].max).toEqual({ path: 'a', value: 100 });
	});
});

describe('aggregateSessionsByProject', () => {
	it('cwd 기준으로 그룹핑해 세션 수·합계·평균을 계산한다', () => {
		const sessions = [
			session({ path: 'a', cwd: '/repo/x', meta: meta({ totalMessages: 10, totalInputTokens: 10, totalOutputTokens: 10 }) }),
			session({ path: 'b', cwd: '/repo/x', meta: meta({ totalMessages: 30, totalInputTokens: 10, totalOutputTokens: 10 }) }),
			session({ path: 'c', cwd: '/repo/y', meta: meta({ totalMessages: 5, totalInputTokens: 0, totalOutputTokens: 0 }) })
		];
		const result = aggregateSessionsByProject(sessions);
		const x = result.find((g) => g.project === '/repo/x');
		const y = result.find((g) => g.project === '/repo/y');

		expect(x?.sessionCount).toBe(2);
		expect(x?.totalMessages).toBe(40);
		expect(x?.avgMessages).toBe(20);
		expect(y?.sessionCount).toBe(1);
		expect(y?.totalMessages).toBe(5);
	});

	it('cwd가 없는 세션은 (unknown) 그룹으로 묶인다', () => {
		const result = aggregateSessionsByProject([session({ path: 'a', meta: meta() })]);
		expect(result.map((g) => g.project)).toEqual(['(unknown)']);
	});

	it('meta가 없는 세션은 sessionCount에는 포함되지만 합계/평균 계산에서는 제외된다', () => {
		const sessions = [
			session({ path: 'a', cwd: '/repo/x', meta: meta({ totalMessages: 10 }) }),
			session({ path: 'b', cwd: '/repo/x' }) // meta 없음
		];
		const [group] = aggregateSessionsByProject(sessions);
		expect(group.sessionCount).toBe(2);
		expect(group.totalMessages).toBe(10);
		expect(group.avgMessages).toBe(10); // metaCount=1 기준
	});

	it('meta 보유 세션이 하나도 없으면 avg는 0이다(0으로 나누지 않는다)', () => {
		const [group] = aggregateSessionsByProject([session({ path: 'a', cwd: '/repo/x' })]);
		expect(group.avgMessages).toBe(0);
		expect(group.avgTokens).toBe(0);
	});

	it('lastActivity는 그룹 내 가장 최근 활동 시각이다', () => {
		const sessions = [
			session({ path: 'a', cwd: '/repo/x', lastTimestamp: '2026-07-20T00:00:00Z' }),
			session({ path: 'b', cwd: '/repo/x', lastTimestamp: '2026-07-23T00:00:00Z' })
		];
		const [group] = aggregateSessionsByProject(sessions);
		expect(group.lastActivity).toBe('2026-07-23T00:00:00Z');
	});

	it('dateFrom/dateTo 조건으로 세션을 필터링한다', () => {
		const sessions = [
			session({ path: 'a', cwd: '/repo/x', lastTimestamp: '2026-07-01T00:00:00Z', meta: meta({ totalMessages: 1 }) }),
			session({ path: 'b', cwd: '/repo/x', lastTimestamp: '2026-07-23T00:00:00Z', meta: meta({ totalMessages: 2 }) })
		];
		const result = aggregateSessionsByProject(sessions, { dateFrom: '2026-07-10T00:00:00Z' });
		expect(result[0].sessionCount).toBe(1);
		expect(result[0].totalMessages).toBe(2);
	});

	it('models 조건으로 세션을 필터링한다(교집합)', () => {
		const sessions = [
			session({ path: 'a', cwd: '/repo/x', meta: meta({ models: ['claude-opus'] }) }),
			session({ path: 'b', cwd: '/repo/x', meta: meta({ models: ['claude-haiku'] }) }),
			session({ path: 'c', cwd: '/repo/x' }) // meta 없음 → 모델 조건 있으면 제외
		];
		const result = aggregateSessionsByProject(sessions, { models: ['claude-haiku'] });
		expect(result[0].sessionCount).toBe(1);
	});

	it('여러 프로젝트를 각각 독립적으로 집계한다', () => {
		const sessions = [
			session({ path: 'a', cwd: '/repo/x', meta: meta({ totalMessages: 1 }) }),
			session({ path: 'b', cwd: '/repo/y', meta: meta({ totalMessages: 2 }) }),
			session({ path: 'c', cwd: '/repo/z', meta: meta({ totalMessages: 3 }) })
		];
		const result = aggregateSessionsByProject(sessions);
		expect(result.map((g) => g.project).sort()).toEqual(['/repo/x', '/repo/y', '/repo/z']);
	});
});
