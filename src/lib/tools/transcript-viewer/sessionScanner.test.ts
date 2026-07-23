/**
 * Unit Tests for Transcript Viewer session summary extraction
 *
 * `extractSessionSummary`는 브라우저 File System Access API 의존이 없는
 * 순수 함수이므로 이 파일에서는 이 함수만 테스트한다.
 * `scanClaudeProjectsDirectory`(FileSystemDirectoryHandle 의존)는 이 child의
 * 범위 밖 — 실브라우저 왕복 확인은 frontend child(_todo-2)의 T4가 소유한다.
 */
import { describe, it, expect } from 'vitest';
import { extractSessionSummary } from './sessionScanner.js';

describe('extractSessionSummary', () => {
	it('정상 fixture(첫 줄 cwd/gitBranch/sessionId + 끝 줄 ai-title/last-prompt/timestamp)에서 각 필드를 채운다', () => {
		const text = [
			JSON.stringify({
				type: 'user',
				cwd: '/repo/mini-toolbox',
				gitBranch: 'main',
				sessionId: 'sess-abc',
				timestamp: '2026-07-23T00:00:00Z'
			}),
			JSON.stringify({
				type: 'assistant',
				message: { role: 'assistant', content: 'hi' },
				timestamp: '2026-07-23T00:00:05Z'
			}),
			JSON.stringify({ type: 'ai-title', aiTitle: '세션 제목' }),
			JSON.stringify({ type: 'last-prompt', lastPrompt: '마지막 질문' })
		].join('\n');

		const result = extractSessionSummary(text, 'p1/sess-abc.jsonl');

		expect(result).not.toBeNull();
		expect(result?.path).toBe('p1/sess-abc.jsonl');
		expect(result?.sessionId).toBe('sess-abc');
		expect(result?.cwd).toBe('/repo/mini-toolbox');
		expect(result?.gitBranch).toBe('main');
		expect(result?.aiTitle).toBe('세션 제목');
		expect(result?.lastPromptPreview).toBe('마지막 질문');
		expect(result?.firstTimestamp).toBe('2026-07-23T00:00:00Z');
		expect(result?.lastTimestamp).toBe('2026-07-23T00:00:05Z');
		expect(result?.subagentCount).toBe(0);
		expect(result?.fileHandle).toBeUndefined();
	});

	it('ai-title 라인이 없는 파일에서 aiTitle이 undefined로 남는다', () => {
		const text = [
			JSON.stringify({ type: 'user', cwd: '/repo', sessionId: 'sess-1' }),
			JSON.stringify({ type: 'last-prompt', lastPrompt: '질문만 있음' })
		].join('\n');

		const result = extractSessionSummary(text, 'p1/sess-1.jsonl');

		expect(result).not.toBeNull();
		expect(result?.aiTitle).toBeUndefined();
		expect(result?.lastPromptPreview).toBe('질문만 있음');
	});

	it('빈 문자열 입력에서 null을 반환한다', () => {
		expect(extractSessionSummary('', 'p1/empty.jsonl')).toBeNull();
	});

	it('유효 JSON 라인이 하나도 없는 입력에서 null을 반환한다', () => {
		const text = 'garbage\nmore garbage';
		expect(extractSessionSummary(text, 'p1/garbage.jsonl')).toBeNull();
	});

	it('유효 라인과 손상된 라인이 섞인 파일에서 손상 라인을 skip하고 유효 메타만 채운다', () => {
		const text = [
			JSON.stringify({ type: 'user', cwd: '/repo', sessionId: 'sess-mix' }),
			'{ broken json line',
			JSON.stringify({ type: 'ai-title', aiTitle: '섞인 파일 제목' })
		].join('\n');

		const result = extractSessionSummary(text, 'p1/mix.jsonl');

		expect(result).not.toBeNull();
		expect(result?.sessionId).toBe('sess-mix');
		expect(result?.aiTitle).toBe('섞인 파일 제목');
	});
});
