/**
 * Transcript Viewer — 연속 발화자 병합 판정
 *
 * 같은 발화자의 연속 메시지를 하나의 시각적 그룹으로 묶기 위해,
 * 직전 메시지와 비교해 발화자 메타 헤더를 렌더링할지 여부를 판정한다.
 *
 * 판정은 구조화 필드(role/isSidechain/model)만 사용한다. 자유텍스트
 * 내용을 기준으로 병합 여부를 추론하지 않는다.
 */

import type { RenderMessage } from './types.js';

/** shouldShowHeader 판정에 필요한 최소 필드만 좁힌 타입 */
export type SpeakerGroupingFields = Pick<RenderMessage, 'role' | 'isSidechain' | 'model'>;

/**
 * 직전 메시지(prev)와 현재 메시지(cur)를 비교해 발화자 메타 헤더를
 * 렌더링해야 하는지 판정한다.
 *
 * - prev가 없으면(첫 메시지) 항상 true.
 * - role, isSidechain, model 중 하나라도 다르면 true(새 발화자 블록).
 * - 모두 같으면 false(직전 블록과 같은 발화자로 병합).
 */
export function shouldShowHeader(prev: SpeakerGroupingFields | undefined, cur: SpeakerGroupingFields): boolean {
	if (!prev) return true;
	if (prev.role !== cur.role) return true;
	if (prev.isSidechain !== cur.isSidechain) return true;
	if (prev.model !== cur.model) return true;
	return false;
}

/** shouldShowDateDivider 판정에 필요한 최소 필드만 좁힌 타입 */
export type DateDividerFields = Pick<RenderMessage, 'timestamp'>;

/** timestamp 문자열을 Date로 파싱한다. 없거나 파싱 불가하면 undefined. */
function parseValidDate(ts: string | undefined): Date | undefined {
	if (!ts) return undefined;
	const d = new Date(ts);
	if (Number.isNaN(d.getTime())) return undefined;
	return d;
}

/** 두 Date의 로컬 연-월-일이 같은지 비교한다. */
function isSameLocalDate(a: Date, b: Date): boolean {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * 직전 메시지(prev)와 현재 메시지(cur)를 비교해 날짜 변경지점 구분선을
 * 렌더링해야 하는지 판정한다.
 *
 * - prev가 없으면(첫 메시지) 항상 true(최초 날짜 구분선).
 * - cur.timestamp가 없거나 파싱 불가(NaN)면 false(직전 유효 날짜 유지, 구분선 삽입 안 함).
 * - prev.timestamp가 없거나 파싱 불가(NaN)면 유효 날짜를 소급 탐색하지 않고 보수적으로 false.
 * - 양쪽 모두 유효하면 로컬 연-월-일이 다를 때만 true.
 */
export function shouldShowDateDivider(prev: DateDividerFields | undefined, cur: DateDividerFields): boolean {
	if (!prev) return true;
	const curDate = parseValidDate(cur.timestamp);
	if (!curDate) return false;
	const prevDate = parseValidDate(prev.timestamp);
	if (!prevDate) return false;
	return !isSameLocalDate(prevDate, curDate);
}
