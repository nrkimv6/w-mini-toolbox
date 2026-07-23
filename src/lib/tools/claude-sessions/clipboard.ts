/**
 * `/claude-sessions` — 클립보드 복사 어댑터
 *
 * 실패를 삼키지 않는다. 호출자가 design prompt 173행("실패한 경우 대상 정보와 결과가 보인다")을
 * 만족시킬 수 있도록 사유를 그대로 반환한다.
 *
 * `document.execCommand('copy')` 폴백은 추가하지 않는다:
 * deprecated API이며, 비보안 컨텍스트(non-HTTPS)에서만 의미가 있는데 이 앱은 HTTPS(Cloudflare
 * Workers)로 배포되어 `navigator.clipboard`가 항상 사용 가능하다. 폴백 도입은 유지비만 늘린다.
 */

export type CopyResult = { ok: true } | { ok: false; reason: 'unsupported' | 'denied' | 'failed' };

export async function copyText(text: string): Promise<CopyResult> {
	if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
		return { ok: false, reason: 'unsupported' };
	}

	try {
		await navigator.clipboard.writeText(text);
		return { ok: true };
	} catch (err) {
		if (err instanceof DOMException && err.name === 'NotAllowedError') {
			return { ok: false, reason: 'denied' };
		}
		return { ok: false, reason: 'failed' };
	}
}
