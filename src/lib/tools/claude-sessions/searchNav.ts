/**
 * `/claude-sessions` 상세 내 검색 — 일치 인덱스 산출 + 이동 순수 함수.
 *
 * 판정 로직(문자열 매칭)은 `transcript-viewer/search.ts`의 `matchesQuery`를 그대로
 * import해서 쓴다(수정 금지 — `/transcript`가 같은 모듈을 공유한다).
 * 이 모듈은 그 판정 결과를 "표시 대상 메시지 배열 안에서의 인덱스 목록"으로 정리하고,
 * 인덱스 사이를 순환 이동하는 로직만 새로 추가한다.
 */
import { matchesQuery } from '$lib/tools/transcript-viewer/search.js';
import type { RenderMessage } from '$lib/tools/transcript-viewer/types.js';

/**
 * `messages`(표시 대상 메시지 배열 — 필터가 이미 적용된 뒤의 배열)에서 `query`와 일치하는
 * 메시지들의 인덱스를 원래 순서대로 반환한다.
 *
 * 반환 인덱스는 "전체 세션 메시지"가 아니라 **호출자가 넘긴 배열 안에서의 인덱스**다.
 * 페이지(+page.svelte)는 필터 적용 후 표시 대상 배열을 만든 다음 이 함수를 호출해야
 * 하며, 그 순서를 뒤집으면(먼저 검색 후 필터) 인덱스가 어긋난다.
 */
export function buildMatchIndex(messages: RenderMessage[], query: string): number[] {
	// matchesQuery는 빈 검색어(trim 후 '')에 항상 true를 반환한다(검색 비활성 = 전체 통과 계약).
	// 이 함수를 그 계약 그대로 쓰면 검색어가 비어 있을 때 "전체 메시지가 일치"로 잡혀버리므로,
	// 여기서는 반대로 빈 검색어면 검색이 아예 비활성 상태라고 보고 빈 배열을 반환한다.
	if (!query.trim()) return [];
	const indices: number[] = [];
	messages.forEach((m, i) => {
		if (matchesQuery(m, query)) indices.push(i);
	});
	return indices;
}

/**
 * 일치 인덱스 배열 안에서 현재 순서(`current`, 0-based)를 `dir` 방향으로 한 칸 순환 이동한다.
 * 마지막 항목에서 다음(+1)으로 이동하면 첫 번째(0)로 돌아오고, 첫 번째에서 이전(-1)으로
 * 이동하면 마지막으로 돌아온다. `total`이 0이면 이동할 대상이 없으므로 -1(이동 불가)을 반환한다.
 */
export function stepMatch(total: number, current: number, dir: 1 | -1): number {
	if (total === 0) return -1;
	// current가 범위 밖(-1 등)이면 다음 이동은 방향에 따라 첫 번째/마지막에서 시작한다.
	if (current < 0 || current >= total) {
		return dir === 1 ? 0 : total - 1;
	}
	return (current + dir + total) % total;
}

/**
 * 검색어/필터 변경으로 일치 수(`total`)가 바뀌었을 때 `current`(이전 순서)를 유효 범위로 보정한다.
 *
 * 정책: `current`가 여전히 유효 범위(`0 <= current < total`) 안이면 **그대로 유지**한다 — 매
 * 키 입력마다 보고 있던 순서를 0으로 되돌리면 사용자가 방금까지 보던 위치를 잃는다. 범위를
 * 벗어난 경우(수가 줄어 `current >= total`이 되었거나, 이전에 -1이었던 경우)에만 **0(첫 번째
 * 일치)으로 리셋**한다 — "마지막에 붙인다"를 선택하지 않은 이유는, 검색어가 완전히 바뀌면 이전
 * 순서와 새 결과 사이에 의미적 연속성이 없어(우연의 일치일 뿐) 가장 앞에서 다시 훑는 쪽이
 * 예측 가능하기 때문이다. `total === 0`이면 이동 불가 상태(-1)를 유지한다.
 */
export function clampCurrent(total: number, current: number): number {
	if (total === 0) return -1;
	if (current < 0 || current >= total) return 0;
	return current;
}

/**
 * `+page.svelte`가 setContext로 하위 컴포넌트(`TextContent`/`ToolCard`/`ThinkingCard`)에 내려주는
 * 검색 상태. `SEARCH_CONTEXT_KEY`는 `transcript-viewer/search.ts`에서 그대로 재사용한다(신규 키를
 * 만들지 않는다 — `/transcript`와 `/claude-sessions`는 동시에 마운트되지 않으므로 키 충돌이 없다).
 *
 * 다만 이 화면은 "현재 확인 중인 일치"를 시각적으로 구분해야 하므로(136행) `transcript-viewer`의
 * `SearchContext`(`{ query }`만 가짐)보다 필드가 하나 더 필요하다. `search.ts`는 수정 금지이므로
 * 이 타입은 독립적으로 정의한다 — `SEARCH_CONTEXT_KEY` 문자열 값만 재사용하고 타입은 재사용하지
 * 않는다.
 */
export interface DetailSearchContext {
	/** debounce된 확정 검색어. 빈 문자열이면 검색 비활성 */
	query: string;
	/**
	 * 현재 nav로 확인 중인 일치 메시지의 `lineIndex`. `buildMatchIndex`가 메시지 단위로 인덱스를
	 * 반환하므로(메시지 내부의 개별 매치 위치까지는 추적하지 않는다) "현재 일치" 구분도 메시지
	 * 단위로 적용한다 — 이 lineIndex를 가진 메시지 안의 모든 `<mark>`가 "현재" 스타일을 받는다.
	 * 일치가 없으면 -1.
	 */
	currentLineIndex: number;
}
