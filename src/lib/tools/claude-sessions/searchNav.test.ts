/**
 * Unit Tests for buildMatchIndex / stepMatch / clampCurrent — 상세 내 검색 순수 함수 계약 검증
 */
import { describe, it, expect } from 'vitest';
import { buildMatchIndex, stepMatch, clampCurrent } from './searchNav.js';
import type { RenderMessage, TextBlock, ToolUseBlock } from '$lib/tools/transcript-viewer/types.js';

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

describe('buildMatchIndex', () => {
	it('buildMatchIndex_정상_본문일치_인덱스반환', () => {
		const messages = [
			message({ lineIndex: 0, content: [textBlock('hello world')] }),
			message({ lineIndex: 1, content: [textBlock('nothing here')] }),
			message({ lineIndex: 2, content: [textBlock('another world')] })
		];
		expect(buildMatchIndex(messages, 'world')).toEqual([0, 2]);
	});

	it('buildMatchIndex_정상_도구이름과입력_일치', () => {
		const byName = [
			message({ lineIndex: 0, content: [toolUseBlock({ name: 'WebSearch' })] }),
			message({ lineIndex: 1, content: [toolUseBlock({ name: 'Bash' })] })
		];
		expect(buildMatchIndex(byName, 'websearch')).toEqual([0]);

		const byInput = [
			message({
				lineIndex: 0,
				content: [toolUseBlock({ name: 'Read', input: { file_path: '/repo/src/app.css' } })]
			}),
			message({ lineIndex: 1, content: [toolUseBlock({ name: 'Read', input: { file_path: '/other.ts' } })] })
		];
		expect(buildMatchIndex(byInput, 'app.css')).toEqual([0]);
	});

	it('buildMatchIndex_경계_빈검색어_빈배열', () => {
		const messages = [message({ content: [textBlock('anything')] })];
		expect(buildMatchIndex(messages, '')).toEqual([]);
		expect(buildMatchIndex(messages, '   ')).toEqual([]);
	});

	it('buildMatchIndex_경계_대소문자무시', () => {
		const messages = [message({ lineIndex: 0, content: [textBlock('Hello World')] })];
		expect(buildMatchIndex(messages, 'HELLO')).toEqual([0]);
		expect(buildMatchIndex(messages, 'hello')).toEqual([0]);
	});
});

describe('stepMatch', () => {
	it('stepMatch_정상_순환이동', () => {
		expect(stepMatch(3, 2, 1)).toBe(0); // 마지막 → 다음 → 0
		expect(stepMatch(3, 0, -1)).toBe(2); // 0 → 이전 → 마지막
		expect(stepMatch(3, 0, 1)).toBe(1);
		expect(stepMatch(3, 1, -1)).toBe(0);
	});

	it('stepMatch_경계_일치0건_음수반환', () => {
		expect(stepMatch(0, 0, 1)).toBe(-1);
		expect(stepMatch(0, -1, -1)).toBe(-1);
	});

	it('stepMatch_경계_음수current에서_시작', () => {
		expect(stepMatch(3, -1, 1)).toBe(0);
		expect(stepMatch(3, -1, -1)).toBe(2);
	});
});

describe('clampCurrent', () => {
	it('clampCurrent_경계_일치수감소_유효범위보정', () => {
		// 이전에 4번째(인덱스 3)를 보고 있었는데 검색어가 바뀌어 일치가 2건으로 줄면 0으로 리셋
		expect(clampCurrent(2, 3)).toBe(0);
	});

	it('clampCurrent_정상_유효범위내_그대로유지', () => {
		expect(clampCurrent(5, 2)).toBe(2);
	});

	it('clampCurrent_경계_일치0건_음수유지', () => {
		expect(clampCurrent(0, 2)).toBe(-1);
	});

	it('clampCurrent_경계_음수current_0으로보정', () => {
		expect(clampCurrent(3, -1)).toBe(0);
	});
});
