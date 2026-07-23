/**
 * `/claude-sessions` — 세션 정보 복사 대상 조립 (순수 로직)
 *
 * design prompt 171·172·174행:
 *   - 세션 식별자/파일 이름/프로젝트명/브랜치명을 각각 복사할 수 있다 (171)
 *   - 확인 가능한 식별 정보를 한 번에 복사할 수 있다 (172)
 *   - 값이 없는 정보에는 복사 조작이 노출되지 않는다 (174)
 *
 * `TranscriptMeta`는 import만 하고 수정하지 않는다 — `/transcript`가 함께 참조하는 공유 타입.
 */
import type { TranscriptMeta } from '$lib/tools/transcript-viewer/types.js';

export interface CopyTarget {
	key: 'sessionId' | 'fileName' | 'project' | 'branch';
	label: string;
	value: string;
}

/** 문자열이 비어 있는지(undefined/빈 문자열/공백뿐) 판정 */
function isBlank(value: string | undefined): value is undefined {
	return value === undefined || value.trim().length === 0;
}

/**
 * `cwd`의 마지막 경로 세그먼트(프로젝트 폴더명)를 반환한다.
 * Windows(`\`)와 POSIX(`/`) 구분자를 모두 처리하고, 후행 구분자는 제거한 뒤 판정한다.
 * 세그먼트가 없으면 `undefined`.
 */
export function projectNameFromCwd(cwd: string | undefined): string | undefined {
	if (isBlank(cwd)) return undefined;
	const normalized = cwd.replace(/\\/g, '/');
	const parts = normalized.split('/').filter((part) => part.length > 0);
	return parts.length > 0 ? parts[parts.length - 1] : undefined;
}

/**
 * 복사 대상 목록을 조립한다. 값이 비어 있는 항목은 배열에서 제외한다(174행).
 * 순서: 세션 식별자 → 파일 이름 → 프로젝트명 → 브랜치명
 */
export function buildCopyTargets(input: { fileName?: string; meta: TranscriptMeta }): CopyTarget[] {
	const { fileName, meta } = input;
	const targets: CopyTarget[] = [];

	if (!isBlank(meta.sessionId)) {
		targets.push({ key: 'sessionId', label: '세션 ID', value: meta.sessionId!.trim() });
	}
	if (!isBlank(fileName)) {
		targets.push({ key: 'fileName', label: '파일 이름', value: fileName!.trim() });
	}
	const project = projectNameFromCwd(meta.cwd);
	if (!isBlank(project)) {
		targets.push({ key: 'project', label: '프로젝트', value: project!.trim() });
	}
	if (!isBlank(meta.gitBranch)) {
		targets.push({ key: 'branch', label: '브랜치', value: meta.gitBranch!.trim() });
	}

	return targets;
}

/**
 * 복사 대상 목록을 `라벨: 값` 형태로 줄바꿈 이어붙여 일괄 복사 문자열을 만든다(172행).
 * 대상이 0건이면 빈 문자열을 반환한다.
 */
export function buildCopyAllText(targets: CopyTarget[]): string {
	return targets.map((t) => `${t.label}: ${t.value}`).join('\n');
}
