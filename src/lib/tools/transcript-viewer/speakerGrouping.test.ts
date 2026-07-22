/**
 * Unit Tests for shouldShowHeader (speaker merge boundary)
 */
import { describe, it, expect } from 'vitest';
import { shouldShowHeader, type SpeakerGroupingFields } from './speakerGrouping.js';

function fields(overrides: Partial<SpeakerGroupingFields> = {}): SpeakerGroupingFields {
	return {
		role: 'assistant',
		isSidechain: false,
		model: 'claude-sonnet-5',
		...overrides
	};
}

describe('shouldShowHeader', () => {
	it('prev가 없으면(첫 메시지) true를 반환한다', () => {
		expect(shouldShowHeader(undefined, fields())).toBe(true);
	});

	it('연속 동일 role(assistant) 2건째부터 false(병합)를 반환한다', () => {
		const prev = fields({ role: 'assistant' });
		const cur = fields({ role: 'assistant' });
		expect(shouldShowHeader(prev, cur)).toBe(false);
	});

	it('role 전환 시 true를 반환한다', () => {
		const prev = fields({ role: 'user' });
		const cur = fields({ role: 'assistant' });
		expect(shouldShowHeader(prev, cur)).toBe(true);
	});

	it('isSidechain 전환 시 true를 반환한다', () => {
		const prev = fields({ isSidechain: false });
		const cur = fields({ isSidechain: true });
		expect(shouldShowHeader(prev, cur)).toBe(true);
	});

	it('model 전환 시 true를 반환한다', () => {
		const prev = fields({ model: 'claude-sonnet-5' });
		const cur = fields({ model: 'claude-opus-5' });
		expect(shouldShowHeader(prev, cur)).toBe(true);
	});
});
