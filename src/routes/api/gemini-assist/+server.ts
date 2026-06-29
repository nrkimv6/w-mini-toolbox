/**
 * Gemini Developer API Server-Side Proxy
 *
 * 설계 계약:
 * - ENABLE_GEMINI_ASSIST 환경변수가 'true'가 아니면 즉시 404 반환 (client key 노출 금지)
 * - GEMINI_API_KEY는 Cloudflare secret으로 주입 (wrangler secret put GEMINI_API_KEY)
 * - Gemini Developer API fetch 직접 호출 (SDK import 금지 — Cloudflare Workers 호환)
 * - free-tier quota guard: 429 수신 시 오류 메시지 반환 (재시도 없음)
 * - 요청 payload: 변환된 Markdown 텍스트만 전송 (원본 HTML 전송 금지)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

/** Cloudflare Workers / SvelteKit platform.env 타입 */
interface GeminiEnv {
	ENABLE_GEMINI_ASSIST?: string;
	GEMINI_API_KEY?: string;
}

/** 클라이언트가 전송하는 요청 본문 */
interface AssistRequest {
	/** HTML-to-MD 변환 결과 텍스트 (원본 HTML 금지) */
	markdownText: string;
}

/** 성공 응답 */
interface AssistResponse {
	result: string;
}

/** 오류 응답 */
interface AssistErrorResponse {
	code: 'DISABLED' | 'QUOTA_EXCEEDED' | 'API_ERROR' | 'INVALID_REQUEST';
	message: string;
}

const GEMINI_API_URL =
	'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const ASSIST_SYSTEM_PROMPT = `당신은 마크다운 문서 편집 전문가입니다.
사용자가 제공한 마크다운 텍스트를 다음 기준으로 개선해 주세요:
- 불필요한 공백과 중복 줄바꿈 제거
- 마크다운 문법 일관성 유지
- 내용은 변경하지 않고 형식만 개선
- 한국어 맞춤법 교정 (내용 변경 없이 오탈자만)
결과는 개선된 마크다운 텍스트만 반환하세요. 설명이나 주석 없이 텍스트만.`;

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = (platform?.env ?? {}) as GeminiEnv;

	// Feature flag gate: ENABLE_GEMINI_ASSIST가 'true'가 아니면 비활성
	if (env.ENABLE_GEMINI_ASSIST !== 'true') {
		throw error(404, {
			message: 'Gemini Assist is not enabled'
		});
	}

	const apiKey = env.GEMINI_API_KEY;
	if (!apiKey) {
		throw error(503, {
			message: 'Gemini API key is not configured'
		});
	}

	// 요청 파싱
	let body: AssistRequest;
	try {
		body = await request.json();
	} catch {
		return json(
			{
				code: 'INVALID_REQUEST',
				message: '요청 형식이 올바르지 않습니다.'
			} satisfies AssistErrorResponse,
			{ status: 400 }
		);
	}

	const { markdownText } = body;

	if (!markdownText || typeof markdownText !== 'string' || !markdownText.trim()) {
		return json(
			{
				code: 'INVALID_REQUEST',
				message: '변환할 텍스트가 없습니다.'
			} satisfies AssistErrorResponse,
			{ status: 400 }
		);
	}

	// 텍스트 길이 제한 (free-tier quota 보호: ~8000자)
	if (markdownText.length > 8000) {
		return json(
			{
				code: 'INVALID_REQUEST',
				message: '텍스트가 너무 깁니다 (최대 8,000자).'
			} satisfies AssistErrorResponse,
			{ status: 400 }
		);
	}

	// Gemini Developer API 호출 (fetch 직접, SDK 금지)
	let geminiResponse: Response;
	try {
		geminiResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				system_instruction: {
					parts: [{ text: ASSIST_SYSTEM_PROMPT }]
				},
				contents: [
					{
						role: 'user',
						parts: [{ text: markdownText }]
					}
				],
				generationConfig: {
					temperature: 0.2,
					maxOutputTokens: 4096
				}
			})
		});
	} catch (fetchErr) {
		console.error('[gemini-assist] fetch error:', fetchErr);
		return json(
			{
				code: 'API_ERROR',
				message: 'Gemini API 연결에 실패했습니다.'
			} satisfies AssistErrorResponse,
			{ status: 502 }
		);
	}

	// free-tier quota guard: 429 재시도 없음
	if (geminiResponse.status === 429) {
		return json(
			{
				code: 'QUOTA_EXCEEDED',
				message: 'Gemini API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.'
			} satisfies AssistErrorResponse,
			{ status: 429 }
		);
	}

	if (!geminiResponse.ok) {
		const errText = await geminiResponse.text().catch(() => '');
		console.error(`[gemini-assist] API error ${geminiResponse.status}:`, errText);
		return json(
			{
				code: 'API_ERROR',
				message: `Gemini API 오류 (${geminiResponse.status})`
			} satisfies AssistErrorResponse,
			{ status: 502 }
		);
	}

	// 응답 파싱
	let data: unknown;
	try {
		data = await geminiResponse.json();
	} catch {
		return json(
			{
				code: 'API_ERROR',
				message: 'Gemini API 응답 파싱 실패'
			} satisfies AssistErrorResponse,
			{ status: 502 }
		);
	}

	const result = extractGeminiText(data);
	if (!result) {
		return json(
			{
				code: 'API_ERROR',
				message: 'Gemini API가 빈 결과를 반환했습니다.'
			} satisfies AssistErrorResponse,
			{ status: 502 }
		);
	}

	return json({ result } satisfies AssistResponse);
};

/** Gemini API 응답에서 텍스트 추출 */
function extractGeminiText(data: unknown): string | null {
	try {
		const d = data as {
			candidates?: Array<{
				content?: {
					parts?: Array<{ text?: string }>;
				};
			}>;
		};
		return d.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
	} catch {
		return null;
	}
}
