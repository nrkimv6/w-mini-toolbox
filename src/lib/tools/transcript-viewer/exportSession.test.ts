/**
 * Unit Tests for Transcript Viewer exportSession(Markdown/JSON 내보내기)
 *
 * `downloadSessionExport`(브라우저 전용 Blob/DOM 트리거)는 여기서 다루지 않는다
 * (localRepository.ts의 createIndexedDbStore와 동일 사유 — post-merge browser T4 소유).
 */
import { describe, it, expect } from 'vitest';
import { buildSessionExport, type ExportSelection } from './exportSession.js';
import type { RenderMessage, TranscriptMeta } from './types.js';

function meta(overrides: Partial<TranscriptMeta> = {}): TranscriptMeta {
	return {
		models: ['claude-opus'],
		totalMessages: 2,
		totalInputTokens: 10,
		totalOutputTokens: 20,
		totalCacheCreationTokens: 0,
		totalCacheReadTokens: 0,
		firstTimestamp: '2026-07-23T00:00:00Z',
		lastTimestamp: '2026-07-23T00:10:00Z',
		...overrides
	};
}

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

function selection(overrides: Partial<ExportSelection> = {}): ExportSelection {
	return {
		session: { path: '/home/user/.claude/projects/p1/sess-1.jsonl', sessionId: 'sess-1', aiTitle: 'My Session', cwd: '/repo/app' },
		meta: meta(),
		messages: [
			msg({ lineIndex: 0, role: 'user', content: [{ type: 'text', text: 'hello secret prompt' }] }),
			msg({
				lineIndex: 1,
				role: 'assistant',
				content: [
					{ type: 'thinking', thinking: 'internal reasoning' },
					{ type: 'text', text: 'hi there' }
				]
			})
		],
		...overrides
	};
}

describe('buildSessionExport — 형식별 안정 출력', () => {
	it('markdown 형식은 안정적으로 동일한 출력을 만든다', () => {
		const s = selection();
		const a = buildSessionExport(s, { format: 'markdown' });
		const b = buildSessionExport(s, { format: 'markdown' });
		expect(a).toEqual(b);
	});

	it('json 형식은 안정적으로 동일한 출력을 만든다', () => {
		const s = selection();
		const a = buildSessionExport(s, { format: 'json' });
		const b = buildSessionExport(s, { format: 'json' });
		expect(a).toEqual(b);
	});

	it('json 출력은 파싱 가능한 JSON이다', () => {
		const result = buildSessionExport(selection(), { format: 'json' });
		expect(result.ok).toBe(true);
		if (result.ok) expect(() => JSON.parse(result.content)).not.toThrow();
	});
});

describe('buildSessionExport — 민감 필드 기본 제외', () => {
	it('기본값에서 메시지 본문을 포함하지 않는다(markdown)', () => {
		const result = buildSessionExport(selection(), { format: 'markdown' });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.content).not.toContain('secret prompt');
			expect(result.content).not.toContain('## Messages');
		}
	});

	it('기본값에서 thinking을 포함하지 않는다', () => {
		const result = buildSessionExport(selection(), { format: 'markdown', includeBody: true });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.content).toContain('hi there');
			expect(result.content).not.toContain('internal reasoning');
		}
	});

	it('기본값에서 전체 경로(path/cwd)를 포함하지 않는다', () => {
		const result = buildSessionExport(selection(), { format: 'markdown' });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.content).not.toContain('/home/user/.claude/projects');
			expect(result.content).not.toContain('/repo/app');
		}
	});

	it('json 기본값에서도 messages/path/cwd 필드가 없다', () => {
		const result = buildSessionExport(selection(), { format: 'json' });
		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.content);
			expect(parsed.messages).toBeUndefined();
			expect(parsed.path).toBeUndefined();
			expect(parsed.cwd).toBeUndefined();
		}
	});
});

describe('buildSessionExport — opt-in 포함', () => {
	it('includeBody: true면 메시지 본문을 포함한다(markdown)', () => {
		const result = buildSessionExport(selection(), { format: 'markdown', includeBody: true });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.content).toContain('secret prompt');
			expect(result.content).toContain('hi there');
		}
	});

	it('includeBody + includeThinking이면 thinking도 포함한다', () => {
		const result = buildSessionExport(selection(), { format: 'markdown', includeBody: true, includeThinking: true });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.content).toContain('internal reasoning');
	});

	it('includeThinking만 true고 includeBody가 false면 본문 섹션 자체가 없다(thinking도 노출 안 됨)', () => {
		const result = buildSessionExport(selection(), { format: 'markdown', includeThinking: true });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.content).not.toContain('internal reasoning');
	});

	it('includeFullPaths: true면 path/cwd를 포함한다', () => {
		const result = buildSessionExport(selection(), { format: 'markdown', includeFullPaths: true });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.content).toContain('/home/user/.claude/projects/p1/sess-1.jsonl');
			expect(result.content).toContain('/repo/app');
		}
	});

	it('json includeBody: true면 messages 배열을 포함한다', () => {
		const result = buildSessionExport(selection(), { format: 'json', includeBody: true });
		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.content);
			expect(Array.isArray(parsed.messages)).toBe(true);
			expect(parsed.messages).toHaveLength(2);
		}
	});
});

describe('buildSessionExport — filename 정규화', () => {
	it('aiTitle의 슬래시/콜론 등 위험 문자를 -로 치환한다', () => {
		const s = selection({ session: { path: 'p', aiTitle: 'a/b:c?d*e' } });
		const result = buildSessionExport(s, { format: 'markdown' });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.filename).toBe('a-b-c-d-e.md');
	});

	it('aiTitle이 없으면 sessionId로 fallback한다', () => {
		const s = selection({ session: { path: 'p', sessionId: 'sess-42' } });
		const result = buildSessionExport(s, { format: 'json' });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.filename).toBe('sess-42.json');
	});

	it('aiTitle/sessionId 둘 다 없으면 session으로 fallback한다', () => {
		const s = selection({ session: { path: 'p' } });
		const result = buildSessionExport(s, { format: 'markdown' });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.filename).toBe('session.md');
	});

	it('options.filename을 지정하면 그것을 정규화해 사용한다', () => {
		const result = buildSessionExport(selection(), { format: 'json', filename: '  My Export!!  ' });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.filename).toBe('My-Export!!.json');
	});

	it('형식에 맞는 확장자를 붙인다', () => {
		const md = buildSessionExport(selection(), { format: 'markdown' });
		const json = buildSessionExport(selection(), { format: 'json' });
		expect(md.ok && md.filename.endsWith('.md')).toBe(true);
		expect(json.ok && json.filename.endsWith('.json')).toBe(true);
	});
});

describe('buildSessionExport — 실패 케이스', () => {
	it('지원하지 않는 format이면 typed 실패를 반환한다', () => {
		const result = buildSessionExport(selection(), { format: 'yaml' as unknown as 'markdown' });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('yaml');
	});
});
