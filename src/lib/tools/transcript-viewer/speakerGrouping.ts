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
