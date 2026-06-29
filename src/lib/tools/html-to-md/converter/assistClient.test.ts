/**
 * Unit Tests for Gemini Assist Client
 *
 * RIGHT-BICEP:
 * - Right: assist 성공 시 결과 텍스트 반환
 * - Boundary: ENABLE_GEMINI_ASSIST=false(404) → fallback 동작 검증
 * - Inverse: fallback 시 원본 텍스트 보존
 * - Cross-check: 429 quota 초과 → fallback 동작 검증
 * - Error: fetch 오류 → fallback 동작 검증
 * - Performance: fetch 0건 검증(빈 텍스트 입력 시)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestAssist } from './assistClient.js';
import type { AssistState } from './assistClient.js';

/** fetch mock 헬퍼 */
function mockFetch(status: number, body: unknown): void {
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue({
			status,
			ok: status >= 200 && status < 300,
			json: () => Promise.resolve(body)
		})
	);
}

/** fetch 실패 mock */
function mockFetchError(message: string): void {
	vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(message)));
}

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('requestAssist — RIGHT: 정상 성공', () => {
	it('성공 응답 시 result 텍스트를 반환한다', async () => {
		mockFetch(200, { result: '# 개선된 마크다운\n\n내용입니다.' });

		const result = await requestAssist('# 마크다운\n\n내용입니다.');

		expect(result.isFallback).toBe(false);
		expect(result.text).toBe('# 개선된 마크다운\n\n내용입니다.');
		expect(result.errorMessage).toBeNull();
	});

	it('성공 시 상태 콜백이 loading → success 순서로 호출된다', async () => {
		mockFetch(200, { result: '개선된 텍스트' });

		const states: AssistState[] = [];
		await requestAssist('입력 텍스트', (s) => states.push({ ...s }));

		expect(states).toHaveLength(2);
		expect(states[0].status).toBe('loading');
		expect(states[1].status).toBe('success');
	});
});

describe('requestAssist — BOUNDARY: ENABLE_GEMINI_ASSIST=false (404)', () => {
	it('서버가 404 반환 시 원본 텍스트로 fallback한다', async () => {
		mockFetch(404, { message: 'Gemini Assist is not enabled' });

		const original = '# 원본 텍스트';
		const result = await requestAssist(original);

		expect(result.isFallback).toBe(true);
		expect(result.text).toBe(original);
		expect(result.errorMessage).toBeTruthy();
	});

	it('404 fallback 시 fetch는 1번만 호출된다 (재시도 없음)', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			status: 404,
			ok: false,
			json: () => Promise.resolve({ message: 'disabled' })
		});
		vi.stubGlobal('fetch', fetchMock);

		await requestAssist('텍스트');

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe('requestAssist — CROSS-CHECK: 429 quota 초과', () => {
	it('429 수신 시 원본 텍스트로 fallback하고 재시도하지 않는다', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			status: 429,
			ok: false,
			json: () =>
				Promise.resolve({
					code: 'QUOTA_EXCEEDED',
					message: '사용량 한도에 도달했습니다.'
				})
		});
		vi.stubGlobal('fetch', fetchMock);

		const original = '# 원본';
		const result = await requestAssist(original);

		expect(result.isFallback).toBe(true);
		expect(result.text).toBe(original);
		expect(result.errorMessage).toContain('한도');
		expect(fetchMock).toHaveBeenCalledTimes(1); // 재시도 없음
	});

	it('429 시 상태 콜백이 error로 전환된다', async () => {
		mockFetch(429, { code: 'QUOTA_EXCEEDED', message: '한도 초과' });

		const states: AssistState[] = [];
		await requestAssist('텍스트', (s) => states.push({ ...s }));

		const lastState = states[states.length - 1];
		expect(lastState.status).toBe('error');
		expect(lastState.errorMessage).toBeTruthy();
	});
});

describe('requestAssist — INVERSE: 실패 시 원본 보존', () => {
	it('5xx 오류 시 원본 텍스트를 그대로 반환한다', async () => {
		mockFetch(502, { code: 'API_ERROR', message: 'Gemini API 오류' });

		const original = '## 원본 헤딩\n\n내용';
		const result = await requestAssist(original);

		expect(result.isFallback).toBe(true);
		expect(result.text).toBe(original);
	});
});

describe('requestAssist — ERROR: 네트워크 오류', () => {
	it('fetch 오류 시 원본 텍스트로 fallback한다', async () => {
		mockFetchError('Network Error');

		const original = '원본 텍스트';
		const result = await requestAssist(original);

		expect(result.isFallback).toBe(true);
		expect(result.text).toBe(original);
		expect(result.errorMessage).toBeTruthy();
	});

	it('네트워크 오류 시 상태 콜백이 error로 전환된다', async () => {
		mockFetchError('Connection refused');

		const states: AssistState[] = [];
		await requestAssist('텍스트', (s) => states.push({ ...s }));

		const lastState = states[states.length - 1];
		expect(lastState.status).toBe('error');
	});
});

describe('requestAssist — PERFORMANCE: 빈 텍스트 입력', () => {
	it('빈 텍스트 입력 시 fetch를 호출하지 않는다 (0건)', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		await requestAssist('');

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('공백만 있는 텍스트 입력 시 fetch를 호출하지 않는다', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		await requestAssist('   \n\t  ');

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('빈 텍스트 입력 시 즉시 fallback 반환한다', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const result = await requestAssist('');

		expect(result.isFallback).toBe(true);
	});
});

describe('requestAssist — 빈 result 처리', () => {
	it('서버가 빈 result를 반환하면 fallback한다', async () => {
		mockFetch(200, { result: '' });

		const original = '원본';
		const result = await requestAssist(original);

		expect(result.isFallback).toBe(true);
		expect(result.text).toBe(original);
	});

	it('서버가 공백 result를 반환하면 fallback한다', async () => {
		mockFetch(200, { result: '   ' });

		const original = '원본';
		const result = await requestAssist(original);

		expect(result.isFallback).toBe(true);
		expect(result.text).toBe(original);
	});
});
