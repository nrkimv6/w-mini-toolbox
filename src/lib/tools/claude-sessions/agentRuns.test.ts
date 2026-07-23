/**
 * Unit Tests for collectAgentRuns — 서브에이전트 런 집계 순수 함수 계약 검증
 *
 * fixture 근거: `~/.claude/projects` 하위 jsonl 전수(subagents 폴더 제외) 실사 대조
 * (계획서 Phase 1 항목 1·2). 실제 라인을 축약·개인정보 치환해 옮겼다. 동기(non-async)
 * 실행 사례와 inline sidechain(구버전) 사례는 실사에서 0건 관측되어 **합성(hand-written)**
 * fixture로 대체했다 — 아래 각 테스트 상단에 "합성" 표기.
 */
import { describe, it, expect } from 'vitest';
import { collectAgentRuns, messagesForAgent } from './agentRuns.js';
import type { RenderMessage, TextBlock, ToolResultBlock, ToolUseBlock } from '$lib/tools/transcript-viewer/types.js';

function textBlock(text: string): TextBlock {
	return { type: 'text', text };
}

function agentToolUse(overrides: Partial<ToolUseBlock> = {}): ToolUseBlock {
	return {
		type: 'tool_use',
		id: 'toolu_agent1',
		name: 'Agent',
		input: { description: '기본 설명', subagent_type: 'claude', model: 'sonnet', prompt: '...' },
		...overrides
	};
}

function agentToolResultBlock(overrides: Partial<ToolResultBlock> = {}): ToolResultBlock {
	return {
		type: 'tool_result',
		tool_use_id: 'toolu_agent1',
		content: [{ type: 'text', text: 'Async agent launched successfully.' }],
		...overrides
	};
}

function message(overrides: Partial<RenderMessage> = {}): RenderMessage {
	return {
		lineIndex: 0,
		lineType: 'assistant',
		role: 'assistant',
		content: [],
		raw: {},
		...overrides
	};
}

describe('collectAgentRuns', () => {
	it('collectAgentRuns_정상_Agent호출_런생성', () => {
		// 실사 fixture 축약: 비동기 Agent 호출 + 후속 tool_result 메시지(toolUseResult 메타 포함)
		const launch = message({
			lineIndex: 10,
			role: 'assistant',
			timestamp: '2026-07-23T05:06:38.000Z',
			content: [agentToolUse({ id: 'toolu_015E6MA9', input: { description: '플랜 구현 위임', model: 'sonnet' } })]
		});
		const result = message({
			lineIndex: 11,
			role: 'user',
			content: [agentToolResultBlock({ tool_use_id: 'toolu_015E6MA9' })],
			raw: {
				toolUseResult: {
					isAsync: true,
					status: 'async_launched',
					agentId: 'a1db586c4629204a1',
					description: '플랜 구현 위임',
					resolvedModel: 'claude-sonnet-5',
					outputFile: 'C:\\tmp\\a1db586c4629204a1.output',
					canReadOutputFile: true
				}
			}
		});

		const runs = collectAgentRuns([launch, result]);

		expect(runs).toHaveLength(1);
		expect(runs[0]).toMatchObject({
			agentId: 'a1db586c4629204a1',
			description: '플랜 구현 위임',
			model: 'claude-sonnet-5',
			status: 'async_launched',
			launchLineIndex: 10,
			launchTimestamp: '2026-07-23T05:06:38.000Z',
			identifierConfirmed: true,
			inlineMessageCount: null,
			lastActivityTimestamp: null
		});
	});

	it('collectAgentRuns_경계_agentId없음_대체키사용', () => {
		// toolUseResult 자체가 없는(아직 결과 메시지가 안 온) Agent 호출
		const launch = message({
			lineIndex: 3,
			content: [agentToolUse({ id: 'toolu_pending', input: { description: '진행 중 위임', model: 'opus' } })]
		});

		const runs = collectAgentRuns([launch]);

		expect(runs).toHaveLength(1);
		expect(runs[0].identifierConfirmed).toBe(false);
		expect(runs[0].agentId).toBe('blockid:toolu_pending');
		// toolUseResult가 없어도 tool_use.input을 대체 소스로 사용한다
		expect(runs[0].description).toBe('진행 중 위임');
		expect(runs[0].model).toBe('opus');
		expect(runs[0].status).toBeUndefined();
	});

	it('collectAgentRuns_경계_동일agentId중복_첫등장병합', () => {
		const first = message({
			lineIndex: 5,
			content: [agentToolUse({ id: 'toolu_a' })]
		});
		const firstResult = message({
			lineIndex: 6,
			role: 'user',
			content: [agentToolResultBlock({ tool_use_id: 'toolu_a' })],
			raw: { toolUseResult: { agentId: 'agent-dup', description: '첫 등장', resolvedModel: 'sonnet' } }
		});
		// 같은 agentId가 재등장(예: SendMessage로 재개하며 다시 Agent 블록이 잡힌 경우 등)
		const second = message({
			lineIndex: 20,
			content: [agentToolUse({ id: 'toolu_b' })]
		});
		const secondResult = message({
			lineIndex: 21,
			role: 'user',
			content: [agentToolResultBlock({ tool_use_id: 'toolu_b' })],
			raw: { toolUseResult: { agentId: 'agent-dup', description: '재등장', resolvedModel: 'opus' } }
		});

		const runs = collectAgentRuns([first, firstResult, second, secondResult]);

		expect(runs).toHaveLength(1);
		expect(runs[0].launchLineIndex).toBe(5);
		expect(runs[0].description).toBe('첫 등장');
	});

	it('collectAgentRuns_경계_Agent없음_빈배열', () => {
		const messages = [
			message({ lineIndex: 0, content: [textBlock('hello')] }),
			message({ lineIndex: 1, content: [agentToolUse({ name: 'Bash', id: 'toolu_bash' } as Partial<ToolUseBlock>)] })
		];

		expect(collectAgentRuns(messages)).toEqual([]);
	});

	it('collectAgentRuns_경계_inline없음_메시지수null', () => {
		const launch = message({ lineIndex: 1, content: [agentToolUse({ id: 'toolu_x' })] });
		const result = message({
			lineIndex: 2,
			role: 'user',
			content: [agentToolResultBlock({ tool_use_id: 'toolu_x' })],
			raw: { toolUseResult: { agentId: 'agent-x' } }
		});

		const runs = collectAgentRuns([launch, result]);

		expect(runs[0].inlineMessageCount).toBeNull();
		expect(runs[0].lastActivityTimestamp).toBeNull();
	});

	it('collectAgentRuns_정상_inline있음_메시지수와마지막활동채움 (합성 fixture — 구버전 세션 미관측)', () => {
		const launch = message({ lineIndex: 1, content: [agentToolUse({ id: 'toolu_y' })] });
		const result = message({
			lineIndex: 2,
			role: 'user',
			content: [agentToolResultBlock({ tool_use_id: 'toolu_y' })],
			raw: { toolUseResult: { agentId: 'agent-y' } }
		});
		// 합성: 구버전 세션에서만 나타나는 inline sidechain 라인(isSidechain:true + raw.agentId)
		const inline1 = message({
			lineIndex: 3,
			isSidechain: true,
			timestamp: '2026-07-23T00:00:01.000Z',
			content: [textBlock('서브에이전트 진행 중 메시지 1')],
			raw: { agentId: 'agent-y' }
		});
		const inline2 = message({
			lineIndex: 4,
			isSidechain: true,
			timestamp: '2026-07-23T00:00:05.000Z',
			content: [textBlock('서브에이전트 진행 중 메시지 2')],
			raw: { agentId: 'agent-y' }
		});

		const runs = collectAgentRuns([launch, result, inline1, inline2]);

		expect(runs[0].inlineMessageCount).toBe(2);
		expect(runs[0].lastActivityTimestamp).toBe('2026-07-23T00:00:05.000Z');
	});

	it('collectAgentRuns_정상_반환순서_launchLineIndex오름차순', () => {
		const late = message({ lineIndex: 50, content: [agentToolUse({ id: 'toolu_late' })] });
		const lateResult = message({
			lineIndex: 51,
			role: 'user',
			content: [agentToolResultBlock({ tool_use_id: 'toolu_late' })],
			raw: { toolUseResult: { agentId: 'agent-late' } }
		});
		const early = message({ lineIndex: 5, content: [agentToolUse({ id: 'toolu_early' })] });
		const earlyResult = message({
			lineIndex: 6,
			role: 'user',
			content: [agentToolResultBlock({ tool_use_id: 'toolu_early' })],
			raw: { toolUseResult: { agentId: 'agent-early' } }
		});

		const runs = collectAgentRuns([late, lateResult, early, earlyResult]);

		// 입력 배열 순서는 late -> early지만, 최종 반환은 launchLineIndex 오름차순으로 정렬돼야 한다
		expect(runs.map((r) => r.agentId)).toEqual(['agent-early', 'agent-late']);
		expect(runs.map((r) => r.launchLineIndex)).toEqual([5, 50]);
	});
});

describe('messagesForAgent', () => {
	it('messagesForAgent_정상_런치와결과와inline만포함', () => {
		const launch = message({ lineIndex: 1, content: [agentToolUse({ id: 'toolu_z' })] });
		const result = message({
			lineIndex: 2,
			role: 'user',
			content: [agentToolResultBlock({ tool_use_id: 'toolu_z' })],
			raw: { toolUseResult: { agentId: 'agent-z' } }
		});
		const inline = message({ lineIndex: 3, isSidechain: true, raw: { agentId: 'agent-z' } });
		const unrelated = message({ lineIndex: 4, content: [textBlock('다른 메시지')] });

		const [run] = collectAgentRuns([launch, result, inline, unrelated]);
		const scoped = messagesForAgent([launch, result, inline, unrelated], run);

		expect(scoped.map((m) => m.lineIndex)).toEqual([1, 2, 3]);
	});

	it('messagesForAgent_경계_식별자확인불가_런치메시지만포함', () => {
		const launch = message({ lineIndex: 1, content: [agentToolUse({ id: 'toolu_unconfirmed' })] });
		const other = message({ lineIndex: 2, content: [textBlock('무관')] });

		const [run] = collectAgentRuns([launch, other]);
		expect(run.identifierConfirmed).toBe(false);

		const scoped = messagesForAgent([launch, other], run);
		expect(scoped.map((m) => m.lineIndex)).toEqual([1]);
	});
});
