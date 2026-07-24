/**
 * Transcript Viewer — 세션 시간 흐름(timeline) 모델
 *
 * 이미 파싱된 `RenderMessage[]`(parser.ts의 `parseTranscript` 산출물)에서
 * 사용자·assistant·tool·tool-error·compact 이벤트를 시간 순서로 산출한다.
 * 각 이벤트는 원본 `lineIndex`를 보존해 상세 메시지 위치로 이동할 수 있게 한다.
 * 브라우저 API 의존이 없는 순수 함수만 포함한다.
 */
import type { RenderMessage, ToolUseBlock } from './types.js';

/** timeline 이벤트 종류 */
export type TimelineEventKind = 'user' | 'assistant' | 'tool' | 'tool-error' | 'compact';

/** 시간 흐름 이벤트 1건 */
export interface TimelineEvent {
	kind: TimelineEventKind;
	/** 원본 메시지의 lineIndex — 상세 메시지 위치 이동에 사용 */
	lineIndex: number;
	/** 원본 메시지의 timestamp. 없으면 시간 미확인 이벤트(정렬 시 맨 앞으로 배치) */
	timestamp?: string;
	/** kind가 'tool'/'tool-error'일 때 도구 이름 */
	toolName?: string;
	/** kind가 'tool'/'tool-error'일 때 tool_use 블록 id */
	toolUseId?: string;
}

/** 내부 정렬용 — 같은 timestamp+lineIndex 내에서 산출 순서를 보존하기 위한 seq */
interface InternalEvent extends TimelineEvent {
	seq: number;
}

/** system 라인의 compact 경계(subtype) 또는 compact 요약 발언 여부 */
function isCompactMessage(message: RenderMessage): boolean {
	return message.subtype === 'compact_boundary' || message.isCompactSummary === true;
}

/**
 * `RenderMessage[]`에서 timeline 이벤트를 산출한다.
 *
 * - compact 메시지(subtype 'compact_boundary' 또는 isCompactSummary)는 'compact' 이벤트 1건만 낸다.
 * - role이 'user'/'assistant'인 메시지는 해당 kind로 기본 이벤트 1건을 낸다.
 * - assistant 메시지의 각 tool_use 블록은 별도 이벤트를 낸다 — 매칭된 tool_result가
 *   `is_error: true`면 'tool-error', 아니면 'tool'.
 * - 그 외 role(system 등 비-compact)은 이 timeline의 범위 밖이라 이벤트를 내지 않는다.
 *
 * 정렬은 `timestamp`(없으면 빈 문자열 — 항상 맨 앞) 오름차순 → `lineIndex` 오름차순 →
 * 산출 순서(seq) 순이다. 동일 timestamp를 가진 이벤트는 이 규칙으로 tie-break된다.
 */
export function buildSessionTimeline(messages: RenderMessage[]): TimelineEvent[] {
	const events: InternalEvent[] = [];
	let seq = 0;

	for (const message of messages) {
		if (isCompactMessage(message)) {
			events.push({ kind: 'compact', lineIndex: message.lineIndex, timestamp: message.timestamp, seq: seq++ });
			continue;
		}

		if (message.role === 'user') {
			events.push({ kind: 'user', lineIndex: message.lineIndex, timestamp: message.timestamp, seq: seq++ });
			continue;
		}

		if (message.role === 'assistant') {
			events.push({ kind: 'assistant', lineIndex: message.lineIndex, timestamp: message.timestamp, seq: seq++ });

			for (const block of message.content) {
				if (block.type !== 'tool_use') continue;
				const tu = block as ToolUseBlock;
				const isError = tu.result?.is_error === true;
				events.push({
					kind: isError ? 'tool-error' : 'tool',
					lineIndex: message.lineIndex,
					timestamp: message.timestamp,
					toolName: tu.name || undefined,
					toolUseId: tu.id || undefined,
					seq: seq++
				});
			}
			continue;
		}
		// 그 외 role(system 등 비-compact)은 이벤트를 내지 않는다
	}

	events.sort((a, b) => {
		const at = a.timestamp ?? '';
		const bt = b.timestamp ?? '';
		if (at !== bt) return at < bt ? -1 : 1;
		if (a.lineIndex !== b.lineIndex) return a.lineIndex - b.lineIndex;
		return a.seq - b.seq;
	});

	return events.map(({ seq: _seq, ...event }) => event);
}

/** 시간 범위 필터 — from/to는 ISO 문자열(포함 경계) */
export interface TimelineRange {
	from?: string;
	to?: string;
}

/**
 * timeline 이벤트를 시간 범위로 좁힌다. `timestamp`가 없는(시간 미확인) 이벤트는
 * 범위를 판정할 수 없으므로 결과에서 제외한다 — 미확인 이벤트는 호출자가 별도로
 * 표시해야 한다(이 함수의 범위 밖).
 */
export function filterTimelineByRange(events: TimelineEvent[], range: TimelineRange): TimelineEvent[] {
	if (!range.from && !range.to) return events;
	return events.filter((event) => {
		if (!event.timestamp) return false;
		if (range.from && event.timestamp < range.from) return false;
		if (range.to && event.timestamp > range.to) return false;
		return true;
	});
}
