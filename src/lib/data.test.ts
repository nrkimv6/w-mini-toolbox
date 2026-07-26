import { describe, expect, it } from 'vitest';
import { tools, filterVisibleTools } from './data.js';

describe('filterVisibleTools', () => {
	it('filterVisibleTools_isAdmin_false_screenshot_제외', () => {
		const visible = filterVisibleTools(tools, false);
		expect(visible.some((t) => t.id === 'screenshot')).toBe(false);
	});

	it('filterVisibleTools_isAdmin_true_전체반환', () => {
		const visible = filterVisibleTools(tools, true);
		expect(visible.length).toBe(tools.length);
	});

	it('filterVisibleTools_isAdmin_false_adminOnly미지정_도구는_유지', () => {
		const visible = filterVisibleTools(tools, false);
		expect(visible.some((t) => t.id === 'html-to-md')).toBe(true);
		expect(visible.some((t) => t.id === 'claude-sessions')).toBe(true);
	});
});
