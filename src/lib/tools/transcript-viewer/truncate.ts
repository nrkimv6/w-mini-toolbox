/**
 * 긴 텍스트를 줄 단위로 잘라 미리보기를 만든다.
 *
 * - 문자 단위로 자르면 마지막 줄이 중간에 깨져 보이므로 항상 줄 경계에서 자른다.
 * - `maxLines`/`maxChars` 중 하나라도 임계 미만이면(원문이 더 짧으면) 원문을 그대로 반환한다.
 * - 임계 초과 시, 앞에서부터 줄을 채워가되 누적 문자 수가 `maxChars`를 넘지 않는 선에서 멈춘다
 *   (단, 최소 1줄은 항상 포함한다).
 */

export interface TruncateResult {
	/** 실제로 보여줄 텍스트 (임계 미만이면 원문과 동일) */
	shown: string;
	/** 잘려서 숨겨진 줄 수 (임계 미만이면 0) */
	hiddenLineCount: number;
	/** 원문 전체 줄 수 */
	totalLines: number;
	/** 원문 전체 문자 수 */
	totalChars: number;
}

export function truncateLines(text: string, maxLines: number, maxChars: number): TruncateResult {
	const totalChars = text.length;
	const lines = text.split('\n');
	const totalLines = lines.length;

	// 임계 미만이면 원문 그대로 반환 (회귀 방지)
	if (totalLines <= maxLines && totalChars <= maxChars) {
		return {
			shown: text,
			hiddenLineCount: 0,
			totalLines,
			totalChars
		};
	}

	let shownLineCount = 0;
	let accumulatedChars = 0;

	for (let i = 0; i < lines.length && i < maxLines; i++) {
		const line = lines[i];
		// 줄바꿈 문자 포함해 누적 (마지막 줄 제외 근사치이나 임계 판단 목적으로는 충분)
		const lineLength = line.length + (i > 0 ? 1 : 0);
		if (shownLineCount > 0 && accumulatedChars + lineLength > maxChars) {
			break;
		}
		accumulatedChars += lineLength;
		shownLineCount++;
	}

	// 최소 1줄은 항상 포함한다
	if (shownLineCount === 0) {
		shownLineCount = 1;
	}

	const shownLines = lines.slice(0, shownLineCount);
	const shown = shownLines.join('\n');
	const hiddenLineCount = totalLines - shownLineCount;

	return {
		shown,
		hiddenLineCount,
		totalLines,
		totalChars
	};
}
