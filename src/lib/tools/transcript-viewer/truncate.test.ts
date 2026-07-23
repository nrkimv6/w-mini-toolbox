/**
 * Unit Tests for truncateLines — 긴 텍스트 줄 단위 truncate 계약 검증
 */
import { describe, it, expect } from 'vitest';
import { truncateLines } from './truncate.js';

describe('truncateLines', () => {
	it('임계(줄/문자) 미만이면 원문을 그대로 반환한다 (회귀 방지)', () => {
		const text = 'line1\nline2\nline3';
		const result = truncateLines(text, 40, 4000);

		expect(result.shown).toBe(text);
		expect(result.hiddenLineCount).toBe(0);
		expect(result.totalLines).toBe(3);
		expect(result.totalChars).toBe(text.length);
	});

	it('빈 문자열은 임계 미만으로 원문 그대로 반환된다', () => {
		const result = truncateLines('', 40, 4000);

		expect(result.shown).toBe('');
		expect(result.hiddenLineCount).toBe(0);
		expect(result.totalLines).toBe(1);
		expect(result.totalChars).toBe(0);
	});

	it('줄 수가 임계를 초과하면 줄 단위로 잘리고 hiddenLineCount가 정확하다', () => {
		const lines = Array.from({ length: 10 }, (_, i) => `line${i}`);
		const text = lines.join('\n');

		const result = truncateLines(text, 4, 10_000);

		expect(result.totalLines).toBe(10);
		expect(result.hiddenLineCount).toBe(6);
		expect(result.shown.split('\n')).toHaveLength(4);
	});

	it('마지막 줄이 중간에 끊기지 않는다 (항상 완전한 줄 단위로 자른다)', () => {
		const lines = Array.from({ length: 10 }, (_, i) => `line${i}-content`);
		const text = lines.join('\n');

		const result = truncateLines(text, 4, 10_000);
		const shownLines = result.shown.split('\n');

		// 보여지는 각 줄은 원본 줄 중 하나와 정확히 일치해야 한다 (중간에 잘리지 않음)
		for (const shownLine of shownLines) {
			expect(lines).toContain(shownLine);
		}
		expect(shownLines[shownLines.length - 1]).toBe(lines[shownLines.length - 1]);
	});

	it('문자 수 임계를 초과하면 문자 임계 내에서 줄 단위로 자른다', () => {
		// 줄 수는 임계 미만이지만 총 문자 수가 임계를 초과하는 경우
		const lines = ['a'.repeat(50), 'b'.repeat(50), 'c'.repeat(50), 'd'.repeat(50)];
		const text = lines.join('\n');

		const result = truncateLines(text, 40, 120);

		expect(result.totalLines).toBe(4);
		expect(result.totalChars).toBe(text.length);
		expect(result.hiddenLineCount).toBeGreaterThan(0);
		// 잘린 결과는 완전한 줄들로만 구성된다
		const shownLines = result.shown.split('\n');
		expect(shownLines.every((l) => lines.includes(l))).toBe(true);
	});

	it('첫 줄 자체가 문자 임계를 초과해도 최소 1줄은 항상 포함한다', () => {
		const hugeLine = 'x'.repeat(5000);
		const text = [hugeLine, 'line2', 'line3'].join('\n');

		const result = truncateLines(text, 40, 100);

		expect(result.shown).toBe(hugeLine);
		expect(result.hiddenLineCount).toBe(2);
	});

	it('줄 수와 문자 수가 동시에 임계를 초과할 때도 최소 1줄은 포함한다', () => {
		const text = Array.from({ length: 5 }, () => 'x'.repeat(1000)).join('\n');

		const result = truncateLines(text, 2, 50);

		expect(result.shown.split('\n').length).toBeGreaterThanOrEqual(1);
		expect(result.hiddenLineCount).toBeGreaterThan(0);
		expect(result.hiddenLineCount).toBeLessThan(result.totalLines);
	});

	it('maxLines와 정확히 같은 줄 수이고 문자 수도 임계 이하이면 원문 그대로 반환된다', () => {
		const lines = Array.from({ length: 5 }, (_, i) => `line${i}`);
		const text = lines.join('\n');

		const result = truncateLines(text, 5, 10_000);

		expect(result.shown).toBe(text);
		expect(result.hiddenLineCount).toBe(0);
	});

	it('totalLines/totalChars는 truncate 여부와 무관하게 원문 전체 기준이다', () => {
		const lines = Array.from({ length: 20 }, (_, i) => `line${i}`);
		const text = lines.join('\n');

		const result = truncateLines(text, 3, 10_000);

		expect(result.totalLines).toBe(20);
		expect(result.totalChars).toBe(text.length);
	});
});
