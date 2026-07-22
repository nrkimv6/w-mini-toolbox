/**
 * Unit Tests for Transcript Viewer JSONL Parser
 */
import { describe, it, expect } from 'vitest';
import { parseTranscript } from './parser.js';

describe('parseTranscript', () => {
	it('정상 라인을 파싱해 메시지 수/역할을 반환한다', () => {
		const jsonl = [
			JSON.stringify({
				type: 'user',
				message: { role: 'user', content: 'hello' },
				timestamp: '2026-07-22T00:00:00Z',
				sessionId: 'sess-1'
			}),
			JSON.stringify({
				type: 'assistant',
				message: {
					role: 'assistant',
					model: 'claude-sonnet-5',
					content: [{ type: 'text', text: 'hi there' }]
				},
				timestamp: '2026-07-22T00:00:01Z'
			})
		].join('\n');

		const result = parseTranscript(jsonl);

		expect(result.messages).toHaveLength(2);
		expect(result.messages[0].role).toBe('user');
		expect(result.messages[1].role).toBe('assistant');
		expect(result.messages[1].model).toBe('claude-sonnet-5');
		expect(result.errors).toHaveLength(0);
	});

	it('손상된(비-JSON) 라인은 skip하고 errors에 기록한다', () => {
		const jsonl = [
			JSON.stringify({ type: 'user', message: { role: 'user', content: 'ok line' } }),
			'{ this is not valid json',
			JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: 'ok again' } })
		].join('\n');

		const result = parseTranscript(jsonl);

		expect(result.messages).toHaveLength(2);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].lineIndex).toBe(1);
	});

	it('tool_use.id 와 tool_result.tool_use_id 를 매칭한다', () => {
		const jsonl = [
			JSON.stringify({
				type: 'assistant',
				message: {
					role: 'assistant',
					content: [{ type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'ls' } }]
				}
			}),
			JSON.stringify({
				type: 'user',
				message: {
					role: 'user',
					content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'file1\nfile2', is_error: false }]
				}
			})
		].join('\n');

		const result = parseTranscript(jsonl);

		const toolUseMsg = result.messages[0];
		const toolUseBlock = toolUseMsg.content[0];
		expect(toolUseBlock.type).toBe('tool_use');
		// tool_use 블록에 매칭된 result가 붙어야 한다
		expect((toolUseBlock as any).result).toBeDefined();
		expect((toolUseBlock as any).result.tool_use_id).toBe('toolu_1');
		expect((toolUseBlock as any).result.content).toBe('file1\nfile2');
	});

	it('content 가 string 인 경우 단일 text 블록으로 정규화한다', () => {
		const jsonl = JSON.stringify({
			type: 'user',
			message: { role: 'user', content: 'plain string content' }
		});

		const result = parseTranscript(jsonl);

		expect(result.messages).toHaveLength(1);
		expect(result.messages[0].content).toHaveLength(1);
		expect(result.messages[0].content[0]).toEqual({ type: 'text', text: 'plain string content' });
	});

	it('토큰 합/model 목록을 집계한다', () => {
		const jsonl = [
			JSON.stringify({
				type: 'assistant',
				message: {
					role: 'assistant',
					model: 'claude-sonnet-5',
					content: [{ type: 'text', text: 'a' }],
					usage: { input_tokens: 100, output_tokens: 50 }
				}
			}),
			JSON.stringify({
				type: 'assistant',
				message: {
					role: 'assistant',
					model: 'claude-opus-4',
					content: [{ type: 'text', text: 'b' }],
					usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 20 }
				}
			})
		].join('\n');

		const result = parseTranscript(jsonl);

		expect(result.meta.totalMessages).toBe(2);
		expect(result.meta.totalInputTokens).toBe(110);
		expect(result.meta.totalOutputTokens).toBe(55);
		expect(result.meta.totalCacheReadTokens).toBe(20);
		expect(result.meta.models.sort()).toEqual(['claude-opus-4', 'claude-sonnet-5']);
	});

	it('공백만 있는 문자열 content는 빈 블록으로 정규화한다', () => {
		const jsonl = [
			JSON.stringify({ type: 'attachment', message: { role: 'attachment', content: '' } }),
			JSON.stringify({ type: 'user', message: { role: 'user', content: '   ' } }),
			JSON.stringify({
				type: 'assistant',
				message: { role: 'assistant', content: [{ type: 'text', text: '  ' }] }
			})
		].join('\n');

		const result = parseTranscript(jsonl);

		// 라인 자체는 3개 파싱되지만 content는 모두 비어야 한다
		expect(result.messages).toHaveLength(3);
		expect(result.messages[0].content).toHaveLength(0);
		expect(result.messages[1].content).toHaveLength(0);
		expect(result.messages[2].content).toHaveLength(0);
	});

	it('compact 흔적 필드(subtype/isCompactSummary)를 파싱한다', () => {
		const jsonl = [
			JSON.stringify({ type: 'system', subtype: 'compact_boundary', content: 'Conversation compacted' }),
			JSON.stringify({
				type: 'user',
				isCompactSummary: true,
				message: { role: 'user', content: 'This session is being continued...' }
			})
		].join('\n');

		const result = parseTranscript(jsonl);

		expect(result.messages[0].subtype).toBe('compact_boundary');
		expect(result.messages[1].isCompactSummary).toBe(true);
	});

	it('빈 줄과 공백 줄은 무시한다', () => {
		const jsonl = [
			'',
			'   ',
			JSON.stringify({ type: 'user', message: { role: 'user', content: 'x' } }),
			''
		].join('\n');

		const result = parseTranscript(jsonl);

		expect(result.messages).toHaveLength(1);
		expect(result.errors).toHaveLength(0);
	});
});
