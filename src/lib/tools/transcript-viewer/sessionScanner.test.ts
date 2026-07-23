/**
 * Unit Tests for Transcript Viewer session summary extraction
 *
 * `extractSessionSummary`는 브라우저 File System Access API 의존이 없는
 * 순수 함수이므로 이 파일에서는 이 함수만 테스트한다.
 * `scanClaudeProjectsDirectory`(FileSystemDirectoryHandle 의존)는 이 child의
 * 범위 밖 — 실브라우저 왕복 확인은 frontend child(_todo-2)의 T4가 소유한다.
 *
 * `scanWithProgress`(진행/취소/부분 실패/generation 확장 진입점)는 in-memory
 * fake handle fixture로 검증한다. late-generation 무시 판정 자체는 UI child가
 * 소유하며, 여기서는 `ScanResult.generation` 전달만 검증한다.
 */
import { describe, it, expect } from 'vitest';
import { extractSessionSummary, scanWithProgress } from './sessionScanner.js';

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

/** in-memory fake FileSystemFileHandle — `.jsonl` 파일 1개를 흉내낸다 */
function fakeFileHandle(
	name: string,
	text: string,
	options: { size?: number; lastModified?: number; failWithMessage?: string } = {}
): FileSystemFileHandle {
	return {
		kind: 'file',
		name,
		async getFile() {
			if (options.failWithMessage) throw new Error(options.failWithMessage);
			return {
				size: options.size ?? text.length,
				lastModified: options.lastModified ?? 0,
				async text() {
					return text;
				}
			} as unknown as File;
		}
	} as unknown as FileSystemFileHandle;
}

/** in-memory fake FileSystemDirectoryHandle — project 폴더를 흉내낸다(subagents 없음 고정) */
function fakeProjectDir(name: string, files: FileSystemFileHandle[]): FileSystemDirectoryHandle {
	return {
		kind: 'directory',
		name,
		async *values() {
			for (const file of files) yield file;
		},
		async getDirectoryHandle() {
			throw new Error('no subagents dir in fixture');
		}
	} as unknown as FileSystemDirectoryHandle;
}

/** in-memory fake root handle — project 폴더 목록을 흉내낸다 */
function fakeRootHandle(projects: FileSystemDirectoryHandle[]): FileSystemDirectoryHandle {
	return {
		kind: 'directory',
		name: 'root',
		async *values() {
			for (const project of projects) yield project;
		}
	} as unknown as FileSystemDirectoryHandle;
}

function validSessionText(sessionId: string): string {
	return JSON.stringify({ type: 'user', cwd: '/repo', sessionId, timestamp: '2026-07-23T00:00:00Z' });
}

describe('scanWithProgress', () => {
	it('일부 파일 read 실패 시 나머지 세션은 보존되고 실패가 failures에 수집된다', async () => {
		const root = fakeRootHandle([
			fakeProjectDir('proj1', [
				fakeFileHandle('ok.jsonl', validSessionText('sess-ok'), { size: 10, lastModified: 111 }),
				fakeFileHandle('broken.jsonl', '', { failWithMessage: 'permission denied' })
			])
		]);

		const result = await scanWithProgress(root);

		expect(result.sessions).toHaveLength(1);
		expect(result.sessions[0].sessionId).toBe('sess-ok');
		expect(result.sessions[0].fileSize).toBe(10);
		expect(result.sessions[0].lastModified).toBe(111);
		expect(result.failures).toEqual([{ path: 'proj1/broken.jsonl', reason: 'permission denied' }]);
		expect(result.cancelled).toBe(false);
	});

	it('abort 시 cancelled: true와 함께 그때까지의 부분 결과를 반환한다', async () => {
		const controller = new AbortController();
		const root = fakeRootHandle([
			fakeProjectDir('proj1', [fakeFileHandle('a.jsonl', validSessionText('sess-a'))]),
			fakeProjectDir('proj2', [fakeFileHandle('b.jsonl', validSessionText('sess-b'))])
		]);

		controller.abort();
		const result = await scanWithProgress(root, { signal: controller.signal });

		expect(result.cancelled).toBe(true);
		expect(result.sessions).toEqual([]);
	});

	it('generation 값이 결과에 그대로 전달된다', async () => {
		const root = fakeRootHandle([]);
		const result = await scanWithProgress(root, { generation: 7 });
		expect(result.generation).toBe(7);
	});

	it('generation 미지정 시 기본값 0이 전달된다', async () => {
		const root = fakeRootHandle([]);
		const result = await scanWithProgress(root);
		expect(result.generation).toBe(0);
	});

	it('onProgress가 파일마다(성공/실패 무관) 호출된다', async () => {
		const root = fakeRootHandle([
			fakeProjectDir('proj1', [
				fakeFileHandle('a.jsonl', validSessionText('sess-a')),
				fakeFileHandle('b.jsonl', '', { failWithMessage: 'boom' })
			])
		]);
		const progressCalls: number[] = [];

		await scanWithProgress(root, { onProgress: (p) => progressCalls.push(p.scanned) });

		expect(progressCalls).toEqual([1, 2]);
	});
});
