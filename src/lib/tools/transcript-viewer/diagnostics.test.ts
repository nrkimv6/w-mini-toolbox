/**
 * Unit Tests for diagnostics.ts — 세션 진단 집계 계약 검증
 */
import { describe, it, expect } from 'vitest';
import {
	computeToolUsage,
	computeToolFailures,
	computeModelSwitches,
	computeLatencies,
	computeCompactCount,
	computeDiagnostics
} from './diagnostics.js';
import type { RenderMessage, ToolUseBlock } from './types.js';

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

function toolUse(name: string, isError?: boolean): ToolUseBlock {
	const block: ToolUseBlock = { type: 'tool_use', id: `id-${name}-${Math.random()}`, name };
	if (isError !== undefined) {
		block.result = { type: 'tool_result', tool_use_id: block.id, content: '', is_error: isError };
	}
	return block;
}

describe('computeToolUsage', () => {
	it('도구별 호출 횟수를 내림차순으로 집계한다 (동률이면 먼저 등장한 도구 우선 — Map 삽입 순서 기반 stable sort)', () => {
		const messages = [
			makeMessage({ lineIndex: 0, content: [toolUse('Bash')] }),
			makeMessage({ lineIndex: 1, content: [toolUse('Read'), toolUse('Read')] }),
			makeMessage({ lineIndex: 2, content: [toolUse('Bash')] })
		];
		const result = computeToolUsage(messages);
		// Bash가 먼저 등장(lineIndex 0)했으므로 count가 같아도(2건씩) Bash가 앞선다
		expect(result).toEqual([
			{ name: 'Bash', count: 2, firstLineIndex: 0 },
			{ name: 'Read', count: 2, firstLineIndex: 1 }
		]);
	});

	it('동률이면 먼저 등장한 도구가 우선한다', () => {
		const messages = [
			makeMessage({ lineIndex: 0, content: [toolUse('Bash')] }),
			makeMessage({ lineIndex: 1, content: [toolUse('Read')] })
		];
		const result = computeToolUsage(messages);
		expect(result[0].name).toBe('Bash');
		expect(result[1].name).toBe('Read');
	});

	it('topN을 초과하는 도구는 잘라낸다', () => {
		const messages = ['A', 'B', 'C', 'D'].map((name, i) =>
			makeMessage({ lineIndex: i, content: [toolUse(name)] })
		);
		const result = computeToolUsage(messages, 2);
		expect(result).toHaveLength(2);
	});

	it('name이 없는 tool_use는 집계에서 제외한다(방어)', () => {
		const badBlock = { type: 'tool_use', id: 'x' } as unknown as ToolUseBlock;
		const messages = [
			makeMessage({ lineIndex: 0, content: [badBlock] }),
			makeMessage({ lineIndex: 1, content: [toolUse('Bash')] })
		];
		const result = computeToolUsage(messages);
		expect(result).toEqual([{ name: 'Bash', count: 1, firstLineIndex: 1 }]);
	});

	it('tool_use가 전혀 없으면 빈 배열을 반환한다', () => {
		const messages = [makeMessage({ lineIndex: 0, content: [{ type: 'text', text: 'hi' }] })];
		expect(computeToolUsage(messages)).toEqual([]);
	});
});

describe('computeToolFailures', () => {
	it('호출 3건 미만인 도구는 rate가 null이고 절대 횟수만 채운다', () => {
		const messages = [
			makeMessage({ lineIndex: 0, content: [toolUse('Bash', true)] }),
			makeMessage({ lineIndex: 1, content: [toolUse('Bash', false)] })
		];
		const result = computeToolFailures(messages);
		expect(result).toEqual([
			{ name: 'Bash', total: 2, failed: 1, rate: null, failedLineIndexes: [0] }
		]);
	});

	it('호출 3건 이상이면 rate = failed/total로 계산한다', () => {
		const messages = [
			makeMessage({ lineIndex: 0, content: [toolUse('Bash', true)] }),
			makeMessage({ lineIndex: 1, content: [toolUse('Bash', false)] }),
			makeMessage({ lineIndex: 2, content: [toolUse('Bash', false)] }),
			makeMessage({ lineIndex: 3, content: [toolUse('Bash', true)] })
		];
		const result = computeToolFailures(messages);
		expect(result[0].name).toBe('Bash');
		expect(result[0].total).toBe(4);
		expect(result[0].failed).toBe(2);
		expect(result[0].rate).toBe(0.5);
		expect(result[0].failedLineIndexes).toEqual([0, 3]);
	});

	it('매칭된 result가 없는 tool_use는 표본에서 제외한다(방어)', () => {
		const messages = [
			makeMessage({ lineIndex: 0, content: [toolUse('Bash')] }), // result 없음
			makeMessage({ lineIndex: 1, content: [toolUse('Bash', true)] })
		];
		const result = computeToolFailures(messages);
		expect(result).toEqual([
			{ name: 'Bash', total: 1, failed: 1, rate: null, failedLineIndexes: [1] }
		]);
	});

	it('실패가 있는 도구를 먼저, 그 다음 총 호출 수 내림차순으로 정렬한다', () => {
		const messages = [
			makeMessage({ lineIndex: 0, content: [toolUse('Read', false)] }),
			makeMessage({ lineIndex: 1, content: [toolUse('Read', false)] }),
			makeMessage({ lineIndex: 2, content: [toolUse('Read', false)] }),
			makeMessage({ lineIndex: 3, content: [toolUse('Bash', true)] })
		];
		const result = computeToolFailures(messages);
		expect(result[0].name).toBe('Bash');
		expect(result[1].name).toBe('Read');
	});

	it('failedLineIndexes는 최대 20개까지만 채운다', () => {
		const messages = Array.from({ length: 25 }, (_, i) =>
			makeMessage({ lineIndex: i, content: [toolUse('Bash', true)] })
		);
		const result = computeToolFailures(messages);
		expect(result[0].failedLineIndexes).toHaveLength(20);
	});
});

describe('computeModelSwitches', () => {
	it('모델이 바뀌는 지점을 순서대로 검출한다', () => {
		const messages = [
			makeMessage({ lineIndex: 0, model: 'claude-sonnet-5' }),
			makeMessage({ lineIndex: 1, model: 'claude-sonnet-5' }),
			makeMessage({ lineIndex: 2, model: 'claude-opus-4' }),
			makeMessage({ lineIndex: 3, model: 'claude-sonnet-5' })
		];
		const result = computeModelSwitches(messages);
		expect(result).toEqual([
			{ lineIndex: 2, fromModel: 'claude-sonnet-5', toModel: 'claude-opus-4' },
			{ lineIndex: 3, fromModel: 'claude-opus-4', toModel: 'claude-sonnet-5' }
		]);
	});

	it('model 필드가 없는 메시지는 건너뛴다(직전 모델 유지)', () => {
		const messages = [
			makeMessage({ lineIndex: 0, model: 'claude-sonnet-5' }),
			makeMessage({ lineIndex: 1 }), // model 없음 (user 메시지 등)
			makeMessage({ lineIndex: 2, model: 'claude-opus-4' })
		];
		const result = computeModelSwitches(messages);
		expect(result).toEqual([{ lineIndex: 2, fromModel: 'claude-sonnet-5', toModel: 'claude-opus-4' }]);
	});

	it('모델이 하나뿐이면 전환이 없다', () => {
		const messages = [
			makeMessage({ lineIndex: 0, model: 'claude-sonnet-5' }),
			makeMessage({ lineIndex: 1, model: 'claude-sonnet-5' })
		];
		expect(computeModelSwitches(messages)).toEqual([]);
	});
});

describe('computeLatencies', () => {
	it('타임스탬프 간격이 큰 상위 N개를 내림차순으로 반환한다', () => {
		const messages = [
			makeMessage({ lineIndex: 0, timestamp: '2026-07-22T00:00:00.000Z' }),
			makeMessage({ lineIndex: 1, timestamp: '2026-07-22T00:00:05.000Z' }), // +5s
			makeMessage({ lineIndex: 2, timestamp: '2026-07-22T00:00:35.000Z' }) // +30s
		];
		const result = computeLatencies(messages);
		expect(result).toEqual([
			{ beforeLineIndex: 1, afterLineIndex: 2, gapMs: 30000 },
			{ beforeLineIndex: 0, afterLineIndex: 1, gapMs: 5000 }
		]);
	});

	it('timestamp가 파싱 불가능하면 건너뛴다(방어)', () => {
		const messages = [
			makeMessage({ lineIndex: 0, timestamp: 'not-a-date' }),
			makeMessage({ lineIndex: 1, timestamp: '2026-07-22T00:00:00.000Z' }),
			makeMessage({ lineIndex: 2, timestamp: '2026-07-22T00:00:10.000Z' })
		];
		const result = computeLatencies(messages);
		expect(result).toEqual([{ beforeLineIndex: 1, afterLineIndex: 2, gapMs: 10000 }]);
	});

	it('간격이 0 이하(로그 역전)면 제외한다', () => {
		const messages = [
			makeMessage({ lineIndex: 0, timestamp: '2026-07-22T00:00:10.000Z' }),
			makeMessage({ lineIndex: 1, timestamp: '2026-07-22T00:00:05.000Z' }) // 역전
		];
		expect(computeLatencies(messages)).toEqual([]);
	});

	it('topN을 초과하면 잘라낸다', () => {
		const base = new Date('2026-07-22T00:00:00.000Z').getTime();
		const messages = Array.from({ length: 5 }, (_, i) =>
			makeMessage({ lineIndex: i, timestamp: new Date(base + i * 1000).toISOString() })
		);
		const result = computeLatencies(messages, 2);
		expect(result).toHaveLength(2);
	});
});

describe('computeCompactCount', () => {
	it('subtype이 compact_boundary인 메시지 수를 센다', () => {
		const messages = [
			makeMessage({ lineIndex: 0, subtype: 'compact_boundary' }),
			makeMessage({ lineIndex: 1 }),
			makeMessage({ lineIndex: 2, subtype: 'compact_boundary' })
		];
		expect(computeCompactCount(messages)).toBe(2);
	});

	it('compact_boundary가 없으면 0을 반환한다', () => {
		const messages = [makeMessage({ lineIndex: 0 })];
		expect(computeCompactCount(messages)).toBe(0);
	});
});

describe('computeDiagnostics', () => {
	it('도구 호출이 전혀 없는 세션에서 빈 결과와 hasToolUsage=false를 반환한다', () => {
		const messages = [
			makeMessage({ lineIndex: 0, content: [{ type: 'text', text: 'hello' }] }),
			makeMessage({ lineIndex: 1, model: 'claude-sonnet-5' })
		];
		const result = computeDiagnostics(messages);
		expect(result.toolUsage).toEqual([]);
		expect(result.toolFailures).toEqual([]);
		expect(result.hasToolUsage).toBe(false);
		expect(result.compactCount).toBe(0);
	});

	it('도구 호출이 있으면 hasToolUsage=true고 각 하위 집계를 모두 채운다', () => {
		const messages = [
			makeMessage({ lineIndex: 0, model: 'claude-sonnet-5', content: [toolUse('Bash', false)] }),
			makeMessage({ lineIndex: 1, subtype: 'compact_boundary' })
		];
		const result = computeDiagnostics(messages);
		expect(result.hasToolUsage).toBe(true);
		expect(result.toolUsage).toEqual([{ name: 'Bash', count: 1, firstLineIndex: 0 }]);
		expect(result.compactCount).toBe(1);
	});
});
