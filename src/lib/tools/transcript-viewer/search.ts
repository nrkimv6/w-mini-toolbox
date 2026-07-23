/**
 * Transcript Viewer — 검색 매칭 순수 함수 + 검색 상태 context 계약.
 *
 * `+page.svelte`에서 필터링에 사용하고, `TextContent.svelte`/`ToolCall.svelte`에서
 * 하이라이트/자동펼침 판단에 사용한다. DOM/Svelte 런타임에 의존하지 않아 단위 테스트가 가능하다.
 */

import type { ContentBlock, RenderMessage, ToolUseBlock } from './types.js';

/** Svelte context에 검색어를 실어 나르기 위한 공용 키. +page.svelte(setContext)와
 * TextContent.svelte/ToolCall.svelte(getContext)가 동일 키를 참조해야 한다. */
export const SEARCH_CONTEXT_KEY = 'transcript-viewer-search';

/** setContext로 공유하는 검색 상태. debounce된 값만 담는다(입력 즉시값 아님). */
export interface SearchContext {
	/** 현재 활성 검색어(trim되지 않은 원문). 빈 문자열이면 검색 비활성 */
	query: string;
}

/** JSON.stringify 실패(순환 참조 등) 시 String()으로 폴백해 항상 문자열을 반환한다 */
function stringifyUnknown(value: unknown): string {
	if (value == null) return '';
	if (typeof value === 'string') return value;
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

/** tool_result.content(string | array | object)를 검색 가능한 평문으로 변환한다.
 * ToolCall.svelte의 formatResultContent와 동일한 정규화 규칙을 따른다. */
function toolResultText(content: unknown): string {
	if (content == null) return '';
	if (typeof content === 'string') return content;
	if (Array.isArray(content)) {
		return content
			.map((c) => {
				if (c && typeof c === 'object' && 'text' in c && typeof (c as { text?: unknown }).text === 'string') {
					return (c as { text: string }).text;
				}
				return stringifyUnknown(c);
			})
			.join('\n');
	}
	return stringifyUnknown(content);
}

/**
 * tool_use 블록(name / input / 매칭된 tool_result.content)이 검색어와 매칭되는지.
 * `needle`은 이미 trim + lowercase된 값이어야 한다.
 */
export function matchesToolUse(block: ToolUseBlock, needle: string): boolean {
	if (!needle) return false;
	if (block.name?.toLowerCase().includes(needle)) return true;
	if (block.input !== undefined && stringifyUnknown(block.input).toLowerCase().includes(needle)) return true;
	if (block.result && toolResultText(block.result.content).toLowerCase().includes(needle)) return true;
	return false;
}

/** 콘텐츠 블록 하나가 검색어와 매칭되는지. `needle`은 trim + lowercase된 값이어야 한다. */
function blockMatches(block: ContentBlock, needle: string): boolean {
	switch (block.type) {
		case 'text':
			return (block.text ?? '').toLowerCase().includes(needle);
		case 'thinking':
			return (block.thinking ?? '').toLowerCase().includes(needle);
		case 'tool_use':
			return matchesToolUse(block, needle);
		default:
			return false;
	}
}

/**
 * 메시지가 검색어(query)와 매칭되는지 — text 본문, tool_use.name, tool_use.input(직렬화),
 * tool_use.result.content를 대소문자 무시로 검사한다. 접혀 있는 카드 내부 콘텐츠도 포함한다.
 * query가 공백뿐이면 항상 true(검색 비활성 = 전체 통과).
 */
export function matchesQuery(m: RenderMessage, query: string): boolean {
	const needle = query.trim().toLowerCase();
	if (!needle) return true;
	for (const block of m.content) {
		if (blockMatches(block, needle)) return true;
	}
	return false;
}
