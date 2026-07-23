/**
 * Claude Sessions — 서브에이전트 런 집계 순수 모듈
 *
 * Phase 1 실물 대조 결과(계획서 `2026-07-23_claude-sessions-subagent-explorer.md`
 * Phase 1 항목 2): 실제 세션 스키마에서 서브에이전트 위임 도구명은 design prompt/원
 * 계획서가 전제한 `Task`가 아니라 **`Agent`**다(`~/.claude/projects` 하위 jsonl 전수
 * 실사에서 `"name":"Task"` 0건, `"name":"Agent"` 244건 관측). 판정은 구조화 필드
 * (`ToolUseBlock.name === 'Agent'`, `toolUseResult.agentId`, `isSidechain` boolean)만
 * 사용하고 프롬프트/결과 자유텍스트 regex는 쓰지 않는다.
 *
 * `toolUseResult`는 `Agent` 호출 자체(assistant 메시지의 tool_use 블록)가 아니라,
 * 그 결과를 받는 **후속 `type:"user"` 메시지**의 최상위 필드에 실린다(그 메시지의
 * `content`에는 `tool_result` 블록이, `raw.toolUseResult`에는 `agentId`/`description`/
 * `resolvedModel`/`status` 등의 메타가 담긴다). `parser.ts`의 `linkToolResults`는
 * `ToolResultBlock`(content/is_error)만 `tool_use.result`로 연결하고 이 메타까지는
 * 옮기지 않으므로, 이 모듈이 `tool_use_id` 기준으로 별도 결합한다. `types.ts`/
 * `parser.ts`/`grouping.ts`는 import만 하고 수정하지 않는다(재사용 경계).
 */
import type { RenderMessage, ToolResultBlock, ToolUseBlock } from '$lib/tools/transcript-viewer/types.js';

/**
 * 서브에이전트 런(=Agent 호출 1건) 요약.
 *
 * 값 규칙(계획서 Phase 2 항목 5):
 * - **확인 불가(구조적으로 절대 채울 수 없음, 형제 파일 필요)** 항목은 `null`
 *   (`inlineMessageCount`/`lastActivityTimestamp`가 대상 — inline sidechain이
 *   0건이면 "메시지가 없었다"가 아니라 "확인할 방법이 없다"는 뜻이라 `0`이 아닌 `null`).
 * - **미확인(옵셔널, 이 세션 원본에 값 자체가 없음)** 항목은 `undefined`
 *   (`description`/`model`/`status`/`launchTimestamp`).
 */
export interface AgentRun {
	agentId: string;
	description?: string;
	model?: string;
	status?: string;
	launchLineIndex: number;
	launchTimestamp?: string;
	inlineMessageCount: number | null;
	lastActivityTimestamp?: string | null;
	/**
	 * 원본에서 실제 `agentId`(toolUseResult.agentId)를 확보했으면 true.
	 * false면 `agentId` 필드는 `ToolUseBlock.id` 기반 대체 키이며, UI는 "식별자 확인
	 * 불가"로 표시해야 한다(design prompt 168행, 계획서 Phase 2 항목 6).
	 */
	identifierConfirmed: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return value != null && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function str(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

/**
 * `messages`(전체 세션 메시지, lineIndex 오름차순)에서 서브에이전트 런 목록을 만든다.
 *
 * - `ToolUseBlock.name === 'Agent'`인 블록만 대상으로 한다.
 * - 같은 `tool_use_id`의 결과 메타(`raw.toolUseResult`)는 후속 tool_result 메시지에서
 *   먼저 전체를 스캔해 맵으로 만든 뒤 결합한다(원본 라인 순서에 의존하지 않음).
 * - 같은 agentId(또는 대체 키)가 여러 번 등장하면 **첫 등장 기준으로 병합**한다.
 *   `messages`가 항상 lineIndex 오름차순으로 들어오므로 먼저 만난 등장이 가장 이른
 *   `launchLineIndex`다(별도 min 비교 불필요).
 * - inline sidechain(`isSidechain === true`) 메시지는 `raw.agentId`로 런에 귀속시켜
 *   `inlineMessageCount`/`lastActivityTimestamp`를 채운다. 0건이면 `null`(확인 불가)로
 *   남긴다 — 현재 세션 스키마에서는 상시 0건이 정상이다(Phase 1 항목 4 참조).
 * - 반환 순서는 `launchLineIndex` 오름차순으로 고정한다.
 */
export function collectAgentRuns(messages: RenderMessage[]): AgentRun[] {
	// 1) tool_use_id -> 결과 메시지의 raw.toolUseResult
	const toolUseResultById = new Map<string, Record<string, unknown>>();
	for (const m of messages) {
		for (const block of m.content) {
			if (block.type !== 'tool_result') continue;
			const toolUseId = (block as ToolResultBlock).tool_use_id;
			if (!toolUseId) continue;
			const tur = asRecord(m.raw?.toolUseResult);
			if (tur) toolUseResultById.set(toolUseId, tur);
		}
	}

	const runs: AgentRun[] = [];
	const indexByKey = new Map<string, number>();

	// 2) Agent 호출 블록 순회 — 런 생성/병합
	for (const m of messages) {
		for (const block of m.content) {
			if (block.type !== 'tool_use') continue;
			const tu = block as ToolUseBlock;
			if (tu.name !== 'Agent') continue;

			const tur = tu.id ? toolUseResultById.get(tu.id) : undefined;
			const agentIdFromResult = tur ? str(tur.agentId) : undefined;
			const identifierConfirmed = agentIdFromResult !== undefined;
			const key = agentIdFromResult ?? `blockid:${tu.id || `line-${m.lineIndex}`}`;

			if (indexByKey.has(key)) continue; // 첫 등장 기준 병합 — 이후 등장은 무시

			const input = asRecord(tu.input) ?? {};
			const description = (tur ? str(tur.description) : undefined) ?? str(input.description);
			const model = (tur ? str(tur.resolvedModel) : undefined) ?? str(input.model);
			const status = tur ? str(tur.status) : undefined;

			indexByKey.set(key, runs.length);
			runs.push({
				agentId: key,
				description,
				model,
				status,
				launchLineIndex: m.lineIndex,
				launchTimestamp: m.timestamp,
				inlineMessageCount: null,
				lastActivityTimestamp: null,
				identifierConfirmed
			});
		}
	}

	// 3) inline sidechain 병합 (구버전 세션 대응)
	for (const m of messages) {
		if (m.isSidechain !== true) continue;
		const rawAgentId = str(m.raw?.agentId);
		if (!rawAgentId) continue;
		const idx = indexByKey.get(rawAgentId);
		if (idx === undefined) continue; // 런치 메시지 없이 inline만 있는 경우는 이 계획서 범위 밖

		const run = runs[idx];
		run.inlineMessageCount = (run.inlineMessageCount ?? 0) + 1;
		if (m.timestamp && (!run.lastActivityTimestamp || m.timestamp > run.lastActivityTimestamp)) {
			run.lastActivityTimestamp = m.timestamp;
		}
	}

	return runs.sort((a, b) => a.launchLineIndex - b.launchLineIndex);
}

/**
 * Phase 4(항목 12) — `run`에 귀속된 메시지만 골라낸다: 런치 메시지(`launchLineIndex`) +
 * 그 결과를 받은 tool_result 메시지(`raw.toolUseResult.agentId` 일치) + inline sidechain
 * 메시지(`raw.agentId` 일치). `identifierConfirmed`가 false(대체 키)면 원본 `agentId` 필드와
 * 비교할 수 없으므로 런치 메시지 자신만 포함한다.
 */
export function messagesForAgent(messages: RenderMessage[], run: AgentRun): RenderMessage[] {
	return messages.filter((m) => {
		if (m.lineIndex === run.launchLineIndex) return true;
		if (!run.identifierConfirmed) return false;

		const tur = asRecord(m.raw?.toolUseResult);
		if (tur && str(tur.agentId) === run.agentId) return true;

		if (m.isSidechain === true && str(m.raw?.agentId) === run.agentId) return true;

		return false;
	});
}
