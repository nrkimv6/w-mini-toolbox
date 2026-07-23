/**
 * Unit Tests for groupSidechainRuns — sub-agent(sidechain) 연속 구간 그룹핑 계약 검증
 */
import { describe, it, expect } from 'vitest';
import { groupSidechainRuns } from './grouping.js';
import type { RenderMessage } from './types.js';

function message(overrides: Partial<RenderMessage> = {}): RenderMessage {
	return {
		lineIndex: 0,
		lineType: 'assistant',
		role: 'assistant',
		content: [],
		raw: {},
		...overrides
	};
}

describe('groupSidechainRuns', () => {
	it('연속된 isSidechain 메시지는 하나의 sidechain-group으로 묶인다', () => {
		const messages = [
			message({ lineIndex: 0, isSidechain: true }),
			message({ lineIndex: 1, isSidechain: true }),
			message({ lineIndex: 2, isSidechain: true })
		];

		const groups = groupSidechainRuns(messages);

		expect(groups).toHaveLength(1);
		expect(groups[0].kind).toBe('sidechain-group');
		if (groups[0].kind === 'sidechain-group') {
			expect(groups[0].messages).toHaveLength(3);
			expect(groups[0].messages.map((m) => m.lineIndex)).toEqual([0, 1, 2]);
		}
	});

	it('비연속 sidechain 구간은 별도 그룹으로 분리된다', () => {
		const messages = [
			message({ lineIndex: 0, isSidechain: true }),
			message({ lineIndex: 1, isSidechain: false }),
			message({ lineIndex: 2, isSidechain: true }),
			message({ lineIndex: 3, isSidechain: true })
		];

		const groups = groupSidechainRuns(messages);

		expect(groups).toHaveLength(3);
		expect(groups[0].kind).toBe('sidechain-group');
		expect(groups[1].kind).toBe('message');
		expect(groups[2].kind).toBe('sidechain-group');
		if (groups[0].kind === 'sidechain-group') {
			expect(groups[0].messages).toHaveLength(1);
		}
		if (groups[2].kind === 'sidechain-group') {
			expect(groups[2].messages).toHaveLength(2);
		}
	});

	it('isSidechain 필드가 전혀 없는 세션에서는 그룹이 0개다(회귀)', () => {
		const messages = [
			message({ lineIndex: 0 }),
			message({ lineIndex: 1 }),
			message({ lineIndex: 2 })
		];

		const groups = groupSidechainRuns(messages);

		expect(groups).toHaveLength(3);
		expect(groups.every((g) => g.kind === 'message')).toBe(true);
		expect(groups.filter((g) => g.kind === 'sidechain-group')).toHaveLength(0);
	});

	it('isSidechain이 명시적으로 false인 메시지도 message로 그대로 통과한다', () => {
		const messages = [message({ lineIndex: 0, isSidechain: false })];

		const groups = groupSidechainRuns(messages);

		expect(groups).toEqual([{ kind: 'message', message: messages[0] }]);
	});

	it('단일 sidechain 메시지(연속 길이 1)도 sidechain-group으로 묶인다', () => {
		const messages = [
			message({ lineIndex: 0, isSidechain: false }),
			message({ lineIndex: 1, isSidechain: true }),
			message({ lineIndex: 2, isSidechain: false })
		];

		const groups = groupSidechainRuns(messages);

		expect(groups).toHaveLength(3);
		expect(groups[1].kind).toBe('sidechain-group');
		if (groups[1].kind === 'sidechain-group') {
			expect(groups[1].messages).toHaveLength(1);
		}
	});

	it('빈 배열 입력 시 빈 배열을 반환한다', () => {
		expect(groupSidechainRuns([])).toEqual([]);
	});

	it('메시지 순서를 보존한다', () => {
		const messages = [
			message({ lineIndex: 0, isSidechain: false }),
			message({ lineIndex: 1, isSidechain: true }),
			message({ lineIndex: 2, isSidechain: true }),
			message({ lineIndex: 3, isSidechain: false })
		];

		const groups = groupSidechainRuns(messages);
		const flattened = groups.flatMap((g) => (g.kind === 'message' ? [g.message] : g.messages));

		expect(flattened.map((m) => m.lineIndex)).toEqual([0, 1, 2, 3]);
	});
});
