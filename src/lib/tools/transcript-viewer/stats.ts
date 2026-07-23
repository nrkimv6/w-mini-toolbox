/**
 * Transcript Viewer — 토큰 통계 파생 계산
 *
 * `usage` 필드 기반 파생 계산만 담당하는 순수 함수 모음. 서버 전송/추가 파싱 없이
 * 이미 파싱된 `RenderMessage[]` / `TranscriptMeta`에서만 값을 도출한다.
 */

import type { RenderMessage, TranscriptMeta } from './types.js';

/** 세션 전체 출력 토큰 분포 요약 */
export interface TokenStats {
	/** 출력 토큰(output_tokens) 중앙값. 표본이 없으면 0. */
	medianOutputTokens: number;
	/**
	 * 이상치 판정 임계값(중앙값의 3배). 표본이 없거나 중앙값이 0이면
	 * `Infinity`로 두어 어떤 메시지도 이상치로 판정되지 않게 한다.
	 */
	outlierThreshold: number;
}

/** 숫자 배열의 중앙값. 빈 배열이면 0. */
function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * 메시지 목록에서 출력 토큰 중앙값과 이상치 임계값(중앙값 3배 초과)을 계산한다.
 * `usage.output_tokens`가 없거나 숫자가 아닌 메시지는 표본에서 제외한다(방어).
 */
export function computeTokenStats(messages: RenderMessage[]): TokenStats {
	const outputs: number[] = [];
	for (const m of messages) {
		const out = m.usage?.output_tokens;
		if (typeof out === 'number' && Number.isFinite(out) && out > 0) {
			outputs.push(out);
		}
	}
	const medianOutputTokens = median(outputs);
	const outlierThreshold = medianOutputTokens > 0 ? medianOutputTokens * 3 : Infinity;
	return { medianOutputTokens, outlierThreshold };
}

/**
 * 캐시 적중률 = cache_read / (cache_read + input).
 * 분모가 0이면(캐시/입력 토큰이 전혀 없는 세션) `null`을 반환해 "0%"로 오인되지 않게 한다.
 */
export function computeCacheHitRate(meta: TranscriptMeta): number | null {
	const denom = meta.totalCacheReadTokens + meta.totalInputTokens;
	if (denom <= 0) return null;
	return meta.totalCacheReadTokens / denom;
}
