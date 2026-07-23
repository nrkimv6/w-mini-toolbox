/**
 * 도구별 요약 추출 — 접힌 카드에 표시할 한 줄 요약.
 *
 * 설계 결정(계획서 참조): 요약 추출은 필드명 기준만 사용한다. 알려진 도구의
 * 알려진 필드(`description`, `command`, `file_path`, `pattern`)에서만 뽑고,
 * 알 수 없는 도구는 요약을 생략한다(null) — 억지 추론보다 공백이 낫다.
 */

const MAX_SUMMARY_LENGTH = 60;
const ELLIPSIS = '…';

/** 개행을 공백으로 접고 앞뒤 공백을 정리한다 */
function collapseWhitespace(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

/** 최대 길이로 자르고 초과 시 말줄임표를 붙인다 */
function clampLength(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength - ELLIPSIS.length).trimEnd() + ELLIPSIS;
}

/** 경로 문자열에서 basename만 추출한다 (posix/windows 구분자 모두 처리) */
function basename(path: string): string {
	const normalized = path.replace(/\\/g, '/');
	const parts = normalized.split('/').filter((p) => p.length > 0);
	return parts.length > 0 ? parts[parts.length - 1] : path;
}

/** 필드가 non-empty 문자열이면 반환, 아니면 undefined */
function stringField(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** input 객체에서 첫 번째 문자열 값을 찾는다 (fallback용) */
function firstStringValue(input: Record<string, unknown>): string | undefined {
	for (const value of Object.values(input)) {
		const s = stringField(value);
		if (s) return s;
	}
	return undefined;
}

/**
 * 도구 이름과 input을 받아 접힌 카드에 표시할 요약 문자열을 반환한다.
 * 알 수 없는 도구/필드 조합이면 null을 반환한다.
 */
export function summarizeToolInput(name: string | undefined, input: unknown): string | null {
	if (input == null || typeof input !== 'object' || Array.isArray(input)) return null;
	const record = input as Record<string, unknown>;

	let raw: string | undefined;

	switch (name) {
		case 'Bash':
			raw = stringField(record.description) ?? stringField(record.command);
			break;
		case 'Read':
		case 'Write':
		case 'Edit': {
			const filePath = stringField(record.file_path);
			raw = filePath ? basename(filePath) : undefined;
			break;
		}
		case 'Grep':
		case 'Glob':
			raw = stringField(record.pattern);
			break;
		case 'Task':
		case 'Agent':
			raw = stringField(record.description);
			break;
		default:
			raw = firstStringValue(record);
			break;
	}

	if (!raw) return null;
	return clampLength(collapseWhitespace(raw), MAX_SUMMARY_LENGTH);
}
