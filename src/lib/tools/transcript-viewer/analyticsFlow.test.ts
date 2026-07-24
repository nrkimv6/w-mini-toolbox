/**
 * Fixture 통합 테스트 — 분석(compare/aggregate) → 내보내기(export) → 메모/태그(annotation) 흐름
 *
 * 개별 모듈(sessionAnalytics.ts/exportSession.ts/localRepository.ts)은 각자 단위 테스트를
 * 갖고 있으므로, 여기서는 세 모듈을 이어 붙인 실제 사용 흐름 하나를 fixture로 검증한다.
 * live/browser 호출(IndexedDB 왕복, Blob 다운로드)은 다루지 않는다(post-merge browser T4 소유).
 *
 * 검증 축:
 * 1) compareSessionMetrics/aggregateSessionsByProject 결과가 buildSessionExport 입력과
 *    일관된 세션 식별자를 사용한다.
 * 2) buildSessionExport 기본값(옵션 미지정)은 메시지 본문·thinking·전체 경로를 포함하지 않는다.
 * 3) annotation(upsertAnnotation) 저장값에는 transcript 본문이 전혀 포함되지 않는다 —
 *    in-memory fake store에 실제로 담기는 값을 직접 검사한다.
 */
import { describe, it, expect } from 'vitest';
import { compareSessionMetrics, aggregateSessionsByProject, type SessionAnalyticsInput } from './sessionAnalytics.js';
import { buildSessionExport, type ExportSelection } from './exportSession.js';
import {
	resolveFavoriteKey,
	upsertAnnotation,
	readAnnotation,
	type LocalRepositoryStore,
	type SessionAnnotation
} from './localRepository.js';
import type { RenderMessage, TranscriptMeta } from './types.js';

const SENSITIVE_PROMPT = 'my secret api key is sk-xyz-should-not-leak';
const SENSITIVE_THINKING = 'internal reasoning that should not leak';
const FULL_PATH = '/home/user/.claude/projects/p1/sess-1.jsonl';
const FULL_CWD = '/home/user/repo/secret-project';

function meta(overrides: Partial<TranscriptMeta> = {}): TranscriptMeta {
	return {
		models: ['claude-opus'],
		totalMessages: 2,
		totalInputTokens: 10,
		totalOutputTokens: 20,
		totalCacheCreationTokens: 1,
		totalCacheReadTokens: 2,
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

const session1: SessionAnalyticsInput = {
	path: FULL_PATH,
	sessionId: 'sess-1',
	aiTitle: 'My Session',
	cwd: FULL_CWD,
	firstTimestamp: '2026-07-23T00:00:00Z',
	lastTimestamp: '2026-07-23T00:10:00Z',
	subagentCount: 1,
	meta: meta()
};

const session2: SessionAnalyticsInput = {
	path: '/home/user/.claude/projects/p1/sess-2.jsonl',
	sessionId: 'sess-2',
	aiTitle: 'Other Session',
	cwd: FULL_CWD,
	firstTimestamp: '2026-07-23T01:00:00Z',
	lastTimestamp: '2026-07-23T01:20:00Z',
	subagentCount: 0,
	meta: meta({ totalMessages: 5, totalInputTokens: 30, totalOutputTokens: 40 })
};

/** in-memory fake LocalRepositoryStore — localRepository.test.ts의 fakeStore와 동일한 최소 구현 */
function fakeStore(): LocalRepositoryStore {
	let schemaVersion: number | undefined;
	let annotations: SessionAnnotation[] = [];
	return {
		async getSchemaVersion() {
			return schemaVersion;
		},
		async setSchemaVersion(version) {
			schemaVersion = version;
		},
		async listFavorites() {
			return [];
		},
		async putFavorite() {},
		async deleteFavorite() {},
		async listRecentFolders() {
			return [];
		},
		async putRecentFolder() {},
		async deleteRecentFolder() {},
		async listAnnotations() {
			return annotations;
		},
		async getAnnotation(sessionKey) {
			return annotations.find((a) => a.sessionKey === sessionKey);
		},
		async putAnnotation(entry) {
			annotations = [...annotations.filter((a) => a.sessionKey !== entry.sessionKey), entry];
		},
		async deleteAnnotation(sessionKey) {
			annotations = annotations.filter((a) => a.sessionKey !== sessionKey);
		},
		async clearAll() {
			schemaVersion = undefined;
			annotations = [];
		}
	};
}

describe('analyticsFlow — compare/aggregate → export → annotation 통합', () => {
	it('compareSessionMetrics/aggregateSessionsByProject가 export/annotation과 동일한 세션 식별자를 사용한다', () => {
		const comparison = compareSessionMetrics([session1, session2]);
		const aggregate = aggregateSessionsByProject([session1, session2]);

		// compare 결과의 path는 export/annotation이 resolveFavoriteKey로 사용하는 것과 같은 session1.path다.
		const totalMessagesMetric = comparison.find((c) => c.metric === 'totalMessages');
		expect(totalMessagesMetric?.values.map((v) => v.path)).toEqual([session1.path, session2.path]);
		expect(resolveFavoriteKey(session1)).toBe(session1.sessionId);

		// 같은 cwd로 묶인 프로젝트 집계 — 두 세션이 하나의 그룹으로 합산된다.
		expect(aggregate).toHaveLength(1);
		expect(aggregate[0].project).toBe(FULL_CWD);
		expect(aggregate[0].sessionCount).toBe(2);
		expect(aggregate[0].totalMessages).toBe(session1.meta!.totalMessages + session2.meta!.totalMessages);
	});

	it('export 기본값은 비교 대상 세션의 민감 정보(본문·thinking·전체 경로)를 포함하지 않는다', () => {
		const selection: ExportSelection = {
			session: { path: session1.path, sessionId: session1.sessionId, aiTitle: session1.aiTitle, cwd: session1.cwd },
			meta: session1.meta!,
			messages: [
				msg({ lineIndex: 0, role: 'user', content: [{ type: 'text', text: SENSITIVE_PROMPT }] }),
				msg({
					lineIndex: 1,
					role: 'assistant',
					content: [
						{ type: 'thinking', thinking: SENSITIVE_THINKING },
						{ type: 'text', text: 'hi there' }
					]
				})
			]
		};

		const markdownResult = buildSessionExport(selection, { format: 'markdown' });
		const jsonResult = buildSessionExport(selection, { format: 'json' });

		expect(markdownResult.ok).toBe(true);
		expect(jsonResult.ok).toBe(true);
		if (markdownResult.ok) {
			expect(markdownResult.content).not.toContain(SENSITIVE_PROMPT);
			expect(markdownResult.content).not.toContain(SENSITIVE_THINKING);
			expect(markdownResult.content).not.toContain(FULL_PATH);
			expect(markdownResult.content).not.toContain(FULL_CWD);
		}
		if (jsonResult.ok) {
			expect(jsonResult.content).not.toContain(SENSITIVE_PROMPT);
			expect(jsonResult.content).not.toContain(SENSITIVE_THINKING);
			expect(jsonResult.content).not.toContain(FULL_PATH);
			expect(jsonResult.content).not.toContain(FULL_CWD);
			const parsed = JSON.parse(jsonResult.content);
			expect(parsed.messages).toBeUndefined();
			expect(parsed.path).toBeUndefined();
			expect(parsed.cwd).toBeUndefined();
		}

		// opt-in하면 포함된다 — 기본 제외가 실제로 옵션에 의존함을 함께 증명한다.
		const optInResult = buildSessionExport(selection, {
			format: 'markdown',
			includeBody: true,
			includeThinking: true,
			includeFullPaths: true
		});
		expect(optInResult.ok).toBe(true);
		if (optInResult.ok) {
			expect(optInResult.content).toContain(SENSITIVE_PROMPT);
			expect(optInResult.content).toContain(SENSITIVE_THINKING);
			expect(optInResult.content).toContain(FULL_CWD);
		}
	});

	it('annotation(메모/태그)에는 transcript 본문이 저장되지 않고 export와 같은 sessionKey로 연결된다', async () => {
		const store = fakeStore();

		const upsertResult = await upsertAnnotation(store, session1, {
			note: '이 세션에서 발견한 이슈 요약',
			tags: ['버그', ' 버그 ', 'Follow-Up']
		});
		expect(upsertResult.ok).toBe(true);

		const readResult = await readAnnotation(store, resolveFavoriteKey(session1));
		expect(readResult.ok).toBe(true);
		if (readResult.ok) {
			expect(readResult.value?.sessionKey).toBe(resolveFavoriteKey(session1));
			expect(readResult.value?.sessionKey).toBe(session1.sessionId);
			// 태그는 정규화되어 중복 제거된다(공백 변형 '버그'/' 버그 '는 1개로 합쳐진다).
			expect(readResult.value?.tags).toEqual(['버그', 'follow-up']);

			// annotation에는 note/tags/식별자 외의 필드(messages/content 등 transcript 본문)가 없다.
			const storedKeys = Object.keys(readResult.value ?? {}).sort();
			expect(storedKeys).toEqual(['createdAt', 'note', 'path', 'sessionId', 'sessionKey', 'tags', 'updatedAt']);

			const serialized = JSON.stringify(readResult.value);
			expect(serialized).not.toContain(SENSITIVE_PROMPT);
			expect(serialized).not.toContain(SENSITIVE_THINKING);
		}
	});
});
