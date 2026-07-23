/**
 * Transcript Viewer — 세션 진단 집계
 *
 * 구조화 필드(`ToolUseBlock.name`, `ToolResultBlock.is_error`, `RenderMessage.model`,
 * `RenderMessage.timestamp`, `RenderMessage.subtype`)만 사용하는 순수 집계 함수 모음.
 * 자유텍스트 분류는 하지 않는다(설계 결정 2).
 */

import type { RenderMessage, ToolUseBlock } from './types.js';

/** 실패율 표시에 필요한 최소 호출 표본 수. 미만이면 절대 횟수만 노출한다(설계 결정 3). */
const MIN_SAMPLES_FOR_RATE = 3;

/** 상위 N개만 노출할 때 기본값 */
const DEFAULT_TOP_N = 5;

/** 도구별 호출 횟수 */
export interface ToolUsageEntry {
	name: string;
	count: number;
	/** 해당 도구 호출 중 첫 번째 발생 위치 — 목록 클릭 점프용 */
	firstLineIndex: number;
}

/** 도구별 실패 정보. 표본이 `MIN_SAMPLES_FOR_RATE` 미만이면 rate는 null(절대 횟수만 의미 있음). */
export interface ToolFailureEntry {
	name: string;
	total: number;
	failed: number;
	/** failed / total. 표본 부족 시 null. */
	rate: number | null;
	/** 실패 발생 라인 인덱스 목록(점프용, 최대 20개) */
	failedLineIndexes: number[];
}

/** 모델이 바뀐 지점 */
export interface ModelSwitchEntry {
	lineIndex: number;
	fromModel: string;
	toModel: string;
}

/** 응답 지연(타임스탬프 간격) 상위 항목 */
export interface LatencyEntry {
	/** 간격이 시작되는(직전) 메시지의 lineIndex — 점프 대상은 간격 뒤 메시지(after)로 한다 */
	beforeLineIndex: number;
	afterLineIndex: number;
	gapMs: number;
}

export interface DiagnosticsSummary {
	toolUsage: ToolUsageEntry[];
	toolFailures: ToolFailureEntry[];
	modelSwitches: ModelSwitchEntry[];
	latencies: LatencyEntry[];
	compactCount: number;
	/** 세션에서 도구 호출이 전혀 없었는지 (진단 패널 빈 상태 판정용) */
	hasToolUsage: boolean;
}

/** 메시지 content에서 tool_use 블록만 추출 */
function toolUseBlocks(m: RenderMessage): ToolUseBlock[] {
	const blocks: ToolUseBlock[] = [];
	for (const b of m.content) {
		if (b.type === 'tool_use') blocks.push(b as ToolUseBlock);
	}
	return blocks;
}

/**
 * 도구별 호출 횟수 상위 N개(내림차순, 동률이면 먼저 등장한 도구 우선).
 * `name`이 없는 tool_use는 집계에서 제외한다(방어).
 */
export function computeToolUsage(messages: RenderMessage[], topN = DEFAULT_TOP_N): ToolUsageEntry[] {
	const byName = new Map<string, ToolUsageEntry>();
	for (const m of messages) {
		for (const t of toolUseBlocks(m)) {
			if (typeof t.name !== 'string' || !t.name) continue;
			const existing = byName.get(t.name);
			if (existing) {
				existing.count += 1;
			} else {
				byName.set(t.name, { name: t.name, count: 1, firstLineIndex: m.lineIndex });
			}
		}
	}
	return [...byName.values()].sort((a, b) => b.count - a.count).slice(0, topN);
}

/**
 * 도구별 실패율. `is_error === true`인 tool_result를 실패로 센다.
 * 매칭된 result가 없는 tool_use는 표본에서 제외한다(방어 — 아직 응답 없는 호출과 구분 불가하므로 넣지 않는다).
 * 3건 미만 호출인 도구는 rate를 null로 두고 절대 횟수(failed/total)만 노출한다.
 */
export function computeToolFailures(messages: RenderMessage[]): ToolFailureEntry[] {
	const byName = new Map<string, { total: number; failed: number; failedLineIndexes: number[] }>();
	for (const m of messages) {
		for (const t of toolUseBlocks(m)) {
			if (typeof t.name !== 'string' || !t.name) continue;
			if (!t.result) continue; // 매칭된 result가 없으면 성공/실패 판정 불가 — 집계 제외
			const entry = byName.get(t.name) ?? { total: 0, failed: 0, failedLineIndexes: [] };
			entry.total += 1;
			if (t.result.is_error === true) {
				entry.failed += 1;
				if (entry.failedLineIndexes.length < 20) entry.failedLineIndexes.push(m.lineIndex);
			}
			byName.set(t.name, entry);
		}
	}
	const result: ToolFailureEntry[] = [];
	for (const [name, entry] of byName) {
		result.push({
			name,
			total: entry.total,
			failed: entry.failed,
			rate: entry.total >= MIN_SAMPLES_FOR_RATE ? entry.failed / entry.total : null,
			failedLineIndexes: entry.failedLineIndexes
		});
	}
	// 실패가 있는 도구를 먼저, 그 다음 총 호출 수 내림차순
	result.sort((a, b) => b.failed - a.failed || b.total - a.total);
	return result;
}

/**
 * 모델이 바뀌는 지점을 순서대로 검출한다. `model` 필드가 있는 메시지만 대상으로 하며,
 * 직전 모델과 다를 때만 전환으로 기록한다.
 */
export function computeModelSwitches(messages: RenderMessage[]): ModelSwitchEntry[] {
	const switches: ModelSwitchEntry[] = [];
	let prevModel: string | undefined;
	for (const m of messages) {
		if (typeof m.model !== 'string' || !m.model) continue;
		if (prevModel && prevModel !== m.model) {
			switches.push({ lineIndex: m.lineIndex, fromModel: prevModel, toModel: m.model });
		}
		prevModel = m.model;
	}
	return switches;
}

/**
 * 타임스탬프 간격이 큰 상위 N개 구간. `timestamp`가 있는 메시지를 원래 순서 그대로 비교하며,
 * 파싱 불가능한 timestamp는 건너뛴다(방어). 간격이 음수(로그 역전)면 제외한다.
 */
export function computeLatencies(messages: RenderMessage[], topN = DEFAULT_TOP_N): LatencyEntry[] {
	const timed: { lineIndex: number; ms: number }[] = [];
	for (const m of messages) {
		if (typeof m.timestamp !== 'string' || !m.timestamp) continue;
		const ms = new Date(m.timestamp).getTime();
		if (Number.isNaN(ms)) continue;
		timed.push({ lineIndex: m.lineIndex, ms });
	}
	const gaps: LatencyEntry[] = [];
	for (let i = 1; i < timed.length; i++) {
		const gapMs = timed[i].ms - timed[i - 1].ms;
		if (gapMs <= 0) continue;
		gaps.push({ beforeLineIndex: timed[i - 1].lineIndex, afterLineIndex: timed[i].lineIndex, gapMs });
	}
	return gaps.sort((a, b) => b.gapMs - a.gapMs).slice(0, topN);
}

/** compact 경계 발생 횟수. `subtype === 'compact_boundary'`인 메시지 수만 센다. */
export function computeCompactCount(messages: RenderMessage[]): number {
	let count = 0;
	for (const m of messages) {
		if (m.subtype === 'compact_boundary') count += 1;
	}
	return count;
}

/** 세션 전체 진단 요약을 한 번에 계산한다. */
export function computeDiagnostics(messages: RenderMessage[]): DiagnosticsSummary {
	const toolUsage = computeToolUsage(messages);
	const toolFailures = computeToolFailures(messages);
	return {
		toolUsage,
		toolFailures,
		modelSwitches: computeModelSwitches(messages),
		latencies: computeLatencies(messages),
		compactCount: computeCompactCount(messages),
		hasToolUsage: toolUsage.length > 0
	};
}
