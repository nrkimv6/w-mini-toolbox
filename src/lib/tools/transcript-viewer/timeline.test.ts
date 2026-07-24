/**
 * Unit Tests for Transcript Viewer timeline(시간 흐름 모델)
 */
import { describe, it, expect } from 'vitest';
import { buildSessionTimeline, filterTimelineByRange } from './timeline.js';
import type { RenderMessage } from './types.js';

function msg(overrides: Partial<RenderMessage> = {}): RenderMessage {
	return {
		lineIndex: 0,
		lineType: 'user',
		role: 'user',
		content: [],
		raw: {},
		...overrides
	};
}

describe('buildSessionTimeline', () => {
	it('user/assistant 메시지를 시간 순서로 산출한다', () => {
		const messages = [
			msg({ lineIndex: 0, role: 'user', timestamp: '2026-07-23T00:00:00Z' }),
			msg({ lineIndex: 1, role: 'assistant', timestamp: '2026-07-23T00:01:00Z' })
		];
		const events = buildSessionTimeline(messages);
		expect(events.map((e) => e.kind)).toEqual(['user', 'assistant']);
		expect(events.map((e) => e.lineIndex)).toEqual([0, 1]);
	});

	it('assistant 메시지의 tool_use 블록마다 tool 이벤트를 낸다', () => {
		const messages = [
			msg({
				lineIndex: 0,
				role: 'assistant',
				timestamp: '2026-07-23T00:00:00Z',
				content: [
					{ type: 'tool_use', id: 't1', name: 'Bash' },
					{ type: 'tool_use', id: 't2', name: 'Read' }
				]
			})
		];
		const events = buildSessionTimeline(messages);
		expect(events.map((e) => e.kind)).toEqual(['assistant', 'tool', 'tool']);
		expect(events[1].toolName).toBe('Bash');
		expect(events[1].toolUseId).toBe('t1');
		expect(events[2].toolName).toBe('Read');
	});

	it('tool_use에 매칭된 tool_result가 is_error면 tool-error 이벤트로 낸다', () => {
		const messages = [
			msg({
				lineIndex: 0,
				role: 'assistant',
				timestamp: '2026-07-23T00:00:00Z',
				content: [
					{
						type: 'tool_use',
						id: 't1',
						name: 'Bash',
						result: { type: 'tool_result', tool_use_id: 't1', content: 'boom', is_error: true }
					}
				]
			})
		];
		const events = buildSessionTimeline(messages);
		expect(events.map((e) => e.kind)).toEqual(['assistant', 'tool-error']);
	});

	it('compact_boundary subtype 메시지는 compact 이벤트로 낸다', () => {
		const messages = [msg({ lineIndex: 0, role: 'system', subtype: 'compact_boundary', timestamp: '2026-07-23T00:00:00Z' })];
		const events = buildSessionTimeline(messages);
		expect(events).toEqual([{ kind: 'compact', lineIndex: 0, timestamp: '2026-07-23T00:00:00Z' }]);
	});

	it('isCompactSummary 메시지도 compact 이벤트로 낸다', () => {
		const messages = [msg({ lineIndex: 0, role: 'user', isCompactSummary: true, timestamp: '2026-07-23T00:00:00Z' })];
		const events = buildSessionTimeline(messages);
		expect(events.map((e) => e.kind)).toEqual(['compact']);
	});

	it('user/assistant/compact가 아닌 role(system 비-compact)은 이벤트를 내지 않는다', () => {
		const messages = [msg({ lineIndex: 0, role: 'system', timestamp: '2026-07-23T00:00:00Z' })];
		expect(buildSessionTimeline(messages)).toEqual([]);
	});

	it('동일 timestamp는 lineIndex 오름차순으로 tie-break한다', () => {
		const messages = [
			msg({ lineIndex: 5, role: 'assistant', timestamp: '2026-07-23T00:00:00Z' }),
			msg({ lineIndex: 2, role: 'user', timestamp: '2026-07-23T00:00:00Z' })
		];
		const events = buildSessionTimeline(messages);
		expect(events.map((e) => e.lineIndex)).toEqual([2, 5]);
	});

	it('같은 lineIndex(assistant 메시지 + 그 tool_use들)는 산출 순서를 유지한다', () => {
		const messages = [
			msg({
				lineIndex: 0,
				role: 'assistant',
				timestamp: '2026-07-23T00:00:00Z',
				content: [
					{ type: 'tool_use', id: 't1', name: 'Bash' },
					{ type: 'tool_use', id: 't2', name: 'Read' }
				]
			})
		];
		const events = buildSessionTimeline(messages);
		// assistant, tool(t1), tool(t2) 모두 timestamp/lineIndex가 같으므로 산출 순서(seq)가 유지되어야 한다
		expect(events.map((e) => e.toolUseId ?? e.kind)).toEqual(['assistant', 't1', 't2']);
	});

	it('timestamp가 없는 이벤트는 정렬 시 맨 앞으로 배치된다', () => {
		const messages = [
			msg({ lineIndex: 0, role: 'user', timestamp: '2026-07-23T00:00:00Z' }),
			msg({ lineIndex: 1, role: 'assistant' }) // timestamp 없음
		];
		const events = buildSessionTimeline(messages);
		expect(events.map((e) => e.lineIndex)).toEqual([1, 0]);
		expect(events[0].timestamp).toBeUndefined();
	});

	it('빈 메시지 목록은 빈 timeline을 반환한다', () => {
		expect(buildSessionTimeline([])).toEqual([]);
	});
});

describe('filterTimelineByRange', () => {
	const events = buildSessionTimeline([
		msg({ lineIndex: 0, role: 'user', timestamp: '2026-07-20T00:00:00Z' }),
		msg({ lineIndex: 1, role: 'assistant', timestamp: '2026-07-22T00:00:00Z' }),
		msg({ lineIndex: 2, role: 'user', timestamp: '2026-07-24T00:00:00Z' }),
		msg({ lineIndex: 3, role: 'assistant' }) // timestamp 없음
	]);

	it('from/to 범위 안의 이벤트만 남긴다', () => {
		const result = filterTimelineByRange(events, { from: '2026-07-21T00:00:00Z', to: '2026-07-23T00:00:00Z' });
		expect(result.map((e) => e.lineIndex)).toEqual([1]);
	});

	it('range가 비어있으면 전체를 그대로 반환한다(시간 미확인 포함)', () => {
		const result = filterTimelineByRange(events, {});
		expect(result).toHaveLength(4);
	});

	it('timestamp가 없는(시간 미확인) 이벤트는 범위 필터에서 항상 제외된다', () => {
		const result = filterTimelineByRange(events, { from: '2026-01-01T00:00:00Z' });
		expect(result.some((e) => e.lineIndex === 3)).toBe(false);
	});

	it('from만 지정하면 그 이후 전체를 포함한다', () => {
		const result = filterTimelineByRange(events, { from: '2026-07-22T00:00:00Z' });
		expect(result.map((e) => e.lineIndex)).toEqual([1, 2]);
	});
});
