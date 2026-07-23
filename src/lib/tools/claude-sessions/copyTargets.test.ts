import { describe, expect, it } from 'vitest';
import { buildCopyAllText, buildCopyTargets, projectNameFromCwd } from './copyTargets.js';
import type { TranscriptMeta } from '$lib/tools/transcript-viewer/types.js';

function baseMeta(overrides: Partial<TranscriptMeta> = {}): TranscriptMeta {
	return {
		sessionId: 'sess-123',
		gitBranch: 'feature/x',
		cwd: 'D:\\work\\project\\tools\\monitor-page',
		version: '1.0.0',
		models: ['claude-opus'],
		totalMessages: 10,
		totalInputTokens: 100,
		totalOutputTokens: 50,
		totalCacheCreationTokens: 0,
		totalCacheReadTokens: 0,
		...overrides
	};
}

describe('buildCopyTargets', () => {
	it('buildCopyTargets_정상_4개항목_전부반환', () => {
		const targets = buildCopyTargets({ fileName: 'session.jsonl', meta: baseMeta() });
		expect(targets.map((t) => t.key)).toEqual(['sessionId', 'fileName', 'project', 'branch']);
		expect(targets).toEqual([
			{ key: 'sessionId', label: '세션 ID', value: 'sess-123' },
			{ key: 'fileName', label: '파일 이름', value: 'session.jsonl' },
			{ key: 'project', label: '프로젝트', value: 'monitor-page' },
			{ key: 'branch', label: '브랜치', value: 'feature/x' }
		]);
	});

	it('buildCopyTargets_경계_값없는항목_제외', () => {
		const targets = buildCopyTargets({
			fileName: 'session.jsonl',
			meta: baseMeta({ gitBranch: undefined, sessionId: '', cwd: '   ' })
		});
		expect(targets.map((t) => t.key)).toEqual(['fileName']);
	});
});

describe('projectNameFromCwd', () => {
	it('projectNameFromCwd_정상_Windows경로_마지막세그먼트', () => {
		expect(projectNameFromCwd('D:\\work\\project\\tools\\monitor-page')).toBe('monitor-page');
	});

	it('projectNameFromCwd_정상_POSIX경로_마지막세그먼트', () => {
		expect(projectNameFromCwd('/home/u/work/mini-toolbox')).toBe('mini-toolbox');
	});

	it('projectNameFromCwd_경계_후행구분자_무시', () => {
		expect(projectNameFromCwd('D:\\work\\monitor-page\\')).toBe('monitor-page');
	});

	it('projectNameFromCwd_경계_빈값_undefined반환', () => {
		expect(projectNameFromCwd(undefined)).toBeUndefined();
		expect(projectNameFromCwd('')).toBeUndefined();
		expect(projectNameFromCwd('\\')).toBeUndefined();
	});
});

describe('buildCopyAllText', () => {
	it('buildCopyAllText_정상_라벨값_줄바꿈조립', () => {
		const targets = buildCopyTargets({ fileName: 'session.jsonl', meta: baseMeta() });
		expect(buildCopyAllText(targets)).toBe(
			['세션 ID: sess-123', '파일 이름: session.jsonl', '프로젝트: monitor-page', '브랜치: feature/x'].join('\n')
		);
	});

	it('buildCopyAllText_경계_빈배열_빈문자열', () => {
		expect(buildCopyAllText([])).toBe('');
	});
});
