/**
 * Gemini Assist Client
 *
 * 설계 계약:
 * - POST /api/gemini-assist 호출로 server-side proxy 경유
 * - 성공 시 assist 결과 반환
 * - 실패 시 deterministic 결과 fallback 유지 (원본 보존)
 * - loading / success / error 3단계 상태 처리
 * - ENABLE_GEMINI_ASSIST feature flag: 서버가 비활성이면 404 반환 → fallback
 */

export type AssistStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AssistState {
	status: AssistStatus;
	/** 마지막 오류 메시지 (error 상태일 때) */
	errorMessage: string | null;
}

/** 서버가 반환하는 오류 코드 */
type ErrorCode = 'DISABLED' | 'QUOTA_EXCEEDED' | 'API_ERROR' | 'INVALID_REQUEST';

interface AssistSuccessResponse {
	result: string;
}

interface AssistErrorResponse {
	code: ErrorCode;
	message: string;
}

/**
 * Gemini Assist 요청 결과
 * - success: 개선된 마크다운 텍스트
 * - fallback: 원본 markdownText 그대로 반환 (실패 시)
 */
export interface AssistResult {
	text: string;
	/** 원본 deterministic 결과에서 fallback한 경우 true */
	isFallback: boolean;
	errorMessage: string | null;
}

const ASSIST_ENDPOINT = '/api/gemini-assist';

/**
 * Gemini Assist를 호출하여 마크다운을 개선합니다.
 * 실패 시 원본 markdownText를 그대로 반환(fallback 보존).
 *
 * @param markdownText - HTML-to-MD 변환 결과 텍스트 (원본 HTML 금지)
 * @param onStateChange - 상태 변화 콜백 (loading → success/error)
 */
export async function requestAssist(
	markdownText: string,
	onStateChange?: (state: AssistState) => void
): Promise<AssistResult> {
	if (!markdownText.trim()) {
		return { text: markdownText, isFallback: true, errorMessage: '텍스트가 없습니다.' };
	}

	onStateChange?.({ status: 'loading', errorMessage: null });

	try {
		const response = await fetch(ASSIST_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ markdownText })
		});

		// 404: feature disabled → fallback (silent)
		if (response.status === 404) {
			onStateChange?.({ status: 'error', errorMessage: 'AI Assist가 비활성 상태입니다.' });
			return {
				text: markdownText,
				isFallback: true,
				errorMessage: 'AI Assist가 비활성 상태입니다.'
			};
		}

		// 429: quota exceeded
		if (response.status === 429) {
			const errBody = await response.json().catch(() => ({}) as AssistErrorResponse);
			const msg =
				(errBody as AssistErrorResponse).message ??
				'사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.';
			onStateChange?.({ status: 'error', errorMessage: msg });
			return { text: markdownText, isFallback: true, errorMessage: msg };
		}

		if (!response.ok) {
			const errBody = await response.json().catch(() => ({}) as AssistErrorResponse);
			const msg = (errBody as AssistErrorResponse).message ?? `서버 오류 (${response.status})`;
			onStateChange?.({ status: 'error', errorMessage: msg });
			return { text: markdownText, isFallback: true, errorMessage: msg };
		}

		const data = (await response.json()) as AssistSuccessResponse;
		if (!data.result || !data.result.trim()) {
			onStateChange?.({ status: 'error', errorMessage: '빈 결과가 반환되었습니다.' });
			return { text: markdownText, isFallback: true, errorMessage: '빈 결과가 반환되었습니다.' };
		}

		onStateChange?.({ status: 'success', errorMessage: null });
		return { text: data.result, isFallback: false, errorMessage: null };
	} catch (err) {
		const msg = err instanceof Error ? err.message : '네트워크 오류가 발생했습니다.';
		onStateChange?.({ status: 'error', errorMessage: msg });
		return { text: markdownText, isFallback: true, errorMessage: msg };
	}
}
