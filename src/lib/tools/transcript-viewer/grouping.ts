/**
 * Transcript Viewer — sub-agent(sidechain) 연속 구간 그룹핑
 *
 * `filteredMessages`를 순서대로 순회하며 `isSidechain === true`인 메시지의
 * 연속 런(run)을 하나의 그룹으로 묶는다. 경계 판정은 구조화 필드
 * `isSidechain` 불리언만 사용한다(자유텍스트 추론 없음).
 */

import type { RenderMessage } from './types.js';

/** 그룹핑된 렌더 단위 — 일반 메시지 1건이거나 sidechain 연속 런 전체 */
export type RenderGroup =
	| { kind: 'message'; message: RenderMessage }
	| { kind: 'sidechain-group'; messages: RenderMessage[] };

/**
 * messages를 순서를 보존하며 RenderGroup[]로 변환한다.
 * - `isSidechain === true`인 메시지가 연속되면 하나의 `sidechain-group`으로 묶는다.
 * - 단일 sidechain 메시지(연속 길이 1)도 `sidechain-group`으로 묶는다(일관된 렌더 계약).
 * - 그 외 메시지는 `message`로 그대로 통과시킨다.
 */
export function groupSidechainRuns(messages: RenderMessage[]): RenderGroup[] {
	const groups: RenderGroup[] = [];
	let currentRun: RenderMessage[] | null = null;

	for (const m of messages) {
		if (m.isSidechain === true) {
			if (!currentRun) {
				currentRun = [];
				groups.push({ kind: 'sidechain-group', messages: currentRun });
			}
			currentRun.push(m);
		} else {
			currentRun = null;
			groups.push({ kind: 'message', message: m });
		}
	}

	return groups;
}
