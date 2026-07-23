/**
 * Unit Tests for stats.ts — 토큰 통계 파생 계산 계약 검증
 */
import { describe, it, expect } from 'vitest';
import { computeTokenStats, computeCacheHitRate } from './stats.js';
import type { RenderMessage, TranscriptMeta } from './types.js';

function makeMessage(overrides: Partial<RenderMessage> = {}): RenderMessage {
	return {
		lineIndex: 0,
		lineType: 'assistant',
		role: 'assistant',
		content: [],
		raw: {},
		...overrides
	};
}

function makeMeta(overrides: Partial<TranscriptMeta> = {}): TranscriptMeta {
	return {
		models: [],
		totalMessages: 0,
		totalInputTokens: 0,
		totalOutputTokens: 0,
		totalCacheCreationTokens: 0,
		totalCacheReadTokens: 0,
		...overrides
	};
}

describe('computeTokenStats', () => {
	it('출력 토큰 홀수 개일 때 중앙값을 정확히 계산한다', () => {
		const messages = [10, 30, 20].map((out, i) =>
			makeMessage({ lineIndex: i, usage: { output_tokens: out } })
		);
		const result = computeTokenStats(messages);
		expect(result.medianOutputTokens).toBe(20);
	});

	it('출력 토큰 짝수 개일 때 중앙값은 가운데 두 값의 평균이다', () => {
		const messages = [10, 20, 30, 40].map((out, i) =>
			makeMessage({ lineIndex: i, usage: { output_tokens: out } })
		);
		const result = computeTokenStats(messages);
		expect(result.medianOutputTokens).toBe(25);
	});

	it('이상치 임계값은 중앙값의 3배다', () => {
		const messages = [10, 20, 30].map((out, i) =>
			makeMessage({ lineIndex: i, usage: { output_tokens: out } })
		);
		const result = computeTokenStats(messages);
		expect(result.medianOutputTokens).toBe(20);
		expect(result.outlierThreshold).toBe(60);
	});

	it('표본이 없으면 중앙값 0, 이상치 임계값은 Infinity다', () => {
		const result = computeTokenStats([]);
		expect(result.medianOutputTokens).toBe(0);
		expect(result.outlierThreshold).toBe(Infinity);
	});

	it('usage가 없는 메시지는 표본에서 제외한다(방어)', () => {
		const messages = [
			makeMessage({ lineIndex: 0 }), // usage 없음
			makeMessage({ lineIndex: 1, usage: {} }), // output_tokens 없음
			makeMessage({ lineIndex: 2, usage: { output_tokens: 10 } })
		];
		const result = computeTokenStats(messages);
		expect(result.medianOutputTokens).toBe(10);
	});

	it('output_tokens가 숫자가 아니거나 0/음수이면 표본에서 제외한다(방어)', () => {
		const messages = [
			makeMessage({ lineIndex: 0, usage: { output_tokens: NaN } }),
			makeMessage({ lineIndex: 1, usage: { output_tokens: 0 } }),
			makeMessage({ lineIndex: 2, usage: { output_tokens: -5 } }),
			// @ts-expect-error 방어 로직 검증을 위해 의도적으로 문자열 주입
			makeMessage({ lineIndex: 3, usage: { output_tokens: 'not-a-number' } }),
			makeMessage({ lineIndex: 4, usage: { output_tokens: 15 } })
		];
		const result = computeTokenStats(messages);
		expect(result.medianOutputTokens).toBe(15);
	});
});

describe('computeCacheHitRate', () => {
	it('캐시 읽기와 입력 토큰이 모두 있으면 비율을 계산한다', () => {
		const meta = makeMeta({ totalCacheReadTokens: 30, totalInputTokens: 70 });
		expect(computeCacheHitRate(meta)).toBe(0.3);
	});

	it('캐시 읽기가 0이어도 입력 토큰이 있으면 0을 반환한다', () => {
		const meta = makeMeta({ totalCacheReadTokens: 0, totalInputTokens: 100 });
		expect(computeCacheHitRate(meta)).toBe(0);
	});

	it('분모(캐시 읽기 + 입력)가 0이면 null을 반환한다("0%" 오인 방지)', () => {
		const meta = makeMeta({ totalCacheReadTokens: 0, totalInputTokens: 0 });
		expect(computeCacheHitRate(meta)).toBeNull();
	});
});
