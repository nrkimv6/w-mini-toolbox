/**
 * Unit Tests for matchesQuery / matchesToolUse — 검색 매칭 순수 함수 계약 검증
 */
import { describe, it, expect } from 'vitest';
import { matchesQuery, matchesToolUse } from './search.js';
import type { RenderMessage, TextBlock, ToolUseBlock } from './types.js';

function textBlock(text: string): TextBlock {
	return { type: 'text', text };
}

function toolUseBlock(overrides: Partial<ToolUseBlock> = {}): ToolUseBlock {
	return {
		type: 'tool_use',
		id: 'tool-1',
		name: 'Bash',
		...overrides
	};
}

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

describe('matchesQuery', () => {
	it('text 본문에 쿼리가 포함되면 true를 반환한다', () => {
		const m = message({ content: [textBlock('hello world')] });
		expect(matchesQuery(m, 'world')).toBe(true);
	});

	it('text 본문에 쿼리가 없으면 false를 반환한다', () => {
		const m = message({ content: [textBlock('hello world')] });
		expect(matchesQuery(m, 'zzz')).toBe(false);
	});

	it('tool_use.name이 쿼리와 매칭되면 true를 반환한다', () => {
		const m = message({ content: [toolUseBlock({ name: 'WebSearch' })] });
		expect(matchesQuery(m, 'websearch')).toBe(true);
	});

	it('tool_use.result.content(접힌 카드 내부)가 쿼리와 매칭되면 true를 반환한다', () => {
		const m = message({
			content: [
				toolUseBlock({
					name: 'Bash',
					result: { type: 'tool_result', tool_use_id: 'tool-1', content: 'needle-in-haystack' }
				})
			]
		});
		expect(matchesQuery(m, 'needle')).toBe(true);
	});

	it('대소문자를 무시하고 매칭한다', () => {
		const m = message({ content: [textBlock('Hello World')] });
		expect(matchesQuery(m, 'HELLO')).toBe(true);
		expect(matchesQuery(m, 'hello')).toBe(true);
	});

	it('빈 쿼리(공백만 포함)이면 항상 true를 반환한다(전체 통과)', () => {
		const m = message({ content: [textBlock('anything')] });
		expect(matchesQuery(m, '')).toBe(true);
		expect(matchesQuery(m, '   ')).toBe(true);
	});

	it('content가 빈 배열이면 빈 쿼리가 아닌 경우 false를 반환한다', () => {
		const m = message({ content: [] });
		expect(matchesQuery(m, 'anything')).toBe(false);
	});
});

describe('matchesToolUse', () => {
	it('needle이 빈 문자열이면 false를 반환한다', () => {
		const block = toolUseBlock({ name: 'Bash' });
		expect(matchesToolUse(block, '')).toBe(false);
	});

	it('name이 needle과 매칭되면 true를 반환한다(대소문자 무시)', () => {
		const block = toolUseBlock({ name: 'ReadFile' });
		expect(matchesToolUse(block, 'readfile')).toBe(true);
	});

	it('input(직렬화)이 needle과 매칭되면 true를 반환한다', () => {
		const block = toolUseBlock({ name: 'Bash', input: { command: 'echo secret-token' } });
		expect(matchesToolUse(block, 'secret-token')).toBe(true);
	});

	it('result.content 배열의 text 필드가 needle과 매칭되면 true를 반환한다', () => {
		const block = toolUseBlock({
			name: 'Bash',
			result: {
				type: 'tool_result',
				tool_use_id: 'tool-1',
				content: [{ type: 'text', text: 'array-content-match' }]
			}
		});
		expect(matchesToolUse(block, 'array-content-match')).toBe(true);
	});

	it('아무 필드도 매칭되지 않으면 false를 반환한다', () => {
		const block = toolUseBlock({ name: 'Bash', input: { command: 'ls' } });
		expect(matchesToolUse(block, 'zzz-not-found')).toBe(false);
	});
});
