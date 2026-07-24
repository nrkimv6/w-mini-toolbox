/**
 * Transcript Viewer — 세션 카탈로그 순수 함수
 *
 * `SessionSummary[]` 입력만으로 동작하는 검색·정렬·재스캔 diff 연산.
 * 브라우저 API(File System Access 등)에 의존하지 않으므로 vitest만으로
 * 검증 가능하다. UI 계층(_todo-2)이 이 함수들을 소비한다.
 */
import { resolveFavoriteKey } from './localRepository.js';
import type { CatalogDiff, SessionQuery, SessionQueryAnnotation, SessionSortKey, SessionSummary, SortDirection } from './types.js';

/** query.annotations(Map 또는 plain object 둘 다 허용)에서 세션에 연결된 annotation을 찾는다 */
function annotationFor(session: SessionSummary, query: SessionQuery): SessionQueryAnnotation | undefined {
	if (!query.annotations) return undefined;
	const key = resolveFavoriteKey(session);
	return query.annotations instanceof Map ? query.annotations.get(key) : query.annotations[key];
}

/**
 * 제목(`aiTitle`)/프로젝트(`cwd`)/브랜치(`gitBranch`)/`sessionId` 중
 * 하나라도 `query.text`를 대소문자 무시 부분일치로 포함하면 통과시킨다
 * (`includeAnnotationText`가 true면 연결된 annotation의 메모/태그도 검색 대상에 포함한다).
 * `query.tags`가 있으면 연결된 annotation의 태그가 모두 포함되어야 통과한다(AND, 대소문자 무시).
 * `query.text`/`query.tags`가 둘 다 비어있거나 미지정이면 전체를 그대로 반환한다.
 */
export function querySessions(sessions: SessionSummary[], query: SessionQuery): SessionSummary[] {
	const text = query.text?.trim().toLowerCase();
	const tagFilter = (query.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0);

	if (!text && tagFilter.length === 0) return sessions;

	return sessions.filter((session) => {
		const annotation = annotationFor(session, query);

		if (text) {
			const fields = [session.aiTitle, session.cwd, session.gitBranch, session.sessionId];
			const baseMatch = fields.some((field) => typeof field === 'string' && field.toLowerCase().includes(text));
			const annotationMatch =
				query.includeAnnotationText && annotation
					? annotation.note.toLowerCase().includes(text) || annotation.tags.some((tag) => tag.includes(text))
					: false;
			if (!baseMatch && !annotationMatch) return false;
		}

		if (tagFilter.length > 0) {
			const sessionTags = annotation?.tags ?? [];
			if (!tagFilter.every((tag) => sessionTags.includes(tag))) return false;
		}

		return true;
	});
}

/** sortSessions의 `key`별 비교 값을 추출한다. undefined는 항상 뒤로 밀린다(fallback 정렬). */
function sortValue(session: SessionSummary, key: SessionSortKey): string | number | undefined {
	switch (key) {
		case 'lastActivity':
			// 종료 시각이 없는 세션은 시작 시각으로 fallback한다
			return session.lastTimestamp ?? session.firstTimestamp;
		case 'title':
			return session.aiTitle?.toLowerCase();
		case 'messageCount':
			// SessionSummary는 전체 파싱 없이 산출되는 경량 요약이라 실제 메시지 수를 담지 않는다.
			// 카탈로그 계층에서 유일하게 존재하는 정수 카운트 필드(subagentCount)를 대리 지표로 사용한다.
			return session.subagentCount;
		default:
			return undefined;
	}
}

/**
 * 최근 활동(`lastActivity`)/제목(`title`)/메시지 수(`messageCount`) 기준으로 정렬한다.
 * 비교 값이 없는 세션은 항상 목록 끝으로 밀리며(방향 무관), 동일 값은 입력 순서를 유지한다(stable).
 */
export function sortSessions(
	sessions: SessionSummary[],
	key: SessionSortKey,
	dir: SortDirection
): SessionSummary[] {
	const withIndex = sessions.map((session, index) => ({ session, index }));

	withIndex.sort((a, b) => {
		const av = sortValue(a.session, key);
		const bv = sortValue(b.session, key);

		if (av == null && bv == null) return a.index - b.index;
		if (av == null) return 1;
		if (bv == null) return -1;

		let cmp: number;
		if (typeof av === 'number' && typeof bv === 'number') {
			cmp = av - bv;
		} else {
			cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
		}
		if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
		return a.index - b.index;
	});

	return withIndex.map((entry) => entry.session);
}

/** diffCatalog의 fingerprint — path는 비교 키, fileSize/lastModified는 변경 감지용 */
function fingerprint(session: SessionSummary): string {
	return `${session.fileSize ?? ''}:${session.lastModified ?? ''}`;
}

/**
 * 이전 카탈로그(`prev`)와 새 카탈로그(`next`)를 `path` 기준으로 비교해
 * 추가·변경·삭제된 경로 목록을 산출한다. 변경 판정은 `fileSize`+`lastModified`
 * fingerprint 불일치 기준이다(둘 다 없으면 변경 없음으로 간주).
 */
export function diffCatalog(prev: SessionSummary[], next: SessionSummary[]): CatalogDiff {
	const prevByPath = new Map(prev.map((session) => [session.path, session]));
	const nextByPath = new Map(next.map((session) => [session.path, session]));

	const added: string[] = [];
	const changed: string[] = [];
	const removed: string[] = [];

	for (const [path, nextSession] of nextByPath) {
		const prevSession = prevByPath.get(path);
		if (!prevSession) {
			added.push(path);
			continue;
		}
		if (fingerprint(prevSession) !== fingerprint(nextSession)) {
			changed.push(path);
		}
	}

	for (const path of prevByPath.keys()) {
		if (!nextByPath.has(path)) removed.push(path);
	}

	return { added, changed, removed };
}
