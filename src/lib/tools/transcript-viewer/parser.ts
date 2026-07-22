/**
 * Transcript Viewer — JSONL 파서
 *
 * Claude Code `.jsonl` transcript 텍스트를 라인 단위로 파싱해 렌더링용
 * 메시지 목록 + 세션 메타 + 파싱 에러 목록으로 정규화한다.
 *
 * 참고(로직 레퍼런스, 그대로 복사하지 않고 JS/TS로 이식):
 * monitor-page/scripts/session_tools/session_dump.py
 */
import type {
	ContentBlock,
	ParseError,
	ParseResult,
	RenderMessage,
	TextBlock,
	ThinkingBlock,
	ToolResultBlock,
	ToolUseBlock,
	TranscriptMeta,
	UsageInfo
} from './types.js';

/** message.content가 string인 경우 단일 TextBlock으로 정규화 */
function normalizeContent(content: unknown): ContentBlock[] {
	if (content == null) return [];

	if (typeof content === 'string') {
		if (!content) return [];
		const block: TextBlock = { type: 'text', text: content };
		return [block];
	}

	if (Array.isArray(content)) {
		const blocks: ContentBlock[] = [];
		for (const item of content) {
			if (item == null || typeof item !== 'object') continue;
			const rec = item as Record<string, unknown>;
			const type = rec.type;
			if (type === 'text' && typeof rec.text === 'string') {
				blocks.push({ type: 'text', text: rec.text } satisfies TextBlock);
			} else if (type === 'thinking') {
				blocks.push({
					type: 'thinking',
					thinking: typeof rec.thinking === 'string' ? rec.thinking : '',
					signature: typeof rec.signature === 'string' ? rec.signature : undefined
				} satisfies ThinkingBlock);
			} else if (type === 'tool_use') {
				blocks.push({
					type: 'tool_use',
					id: typeof rec.id === 'string' ? rec.id : '',
					name: typeof rec.name === 'string' ? rec.name : '',
					input: rec.input,
					caller: typeof rec.caller === 'string' ? rec.caller : undefined
				} satisfies ToolUseBlock);
			} else if (type === 'tool_result') {
				blocks.push({
					type: 'tool_result',
					tool_use_id: typeof rec.tool_use_id === 'string' ? rec.tool_use_id : '',
					content: rec.content,
					is_error: rec.is_error === true
				} satisfies ToolResultBlock);
			} else if (typeof type === 'string') {
				blocks.push({ ...rec, type } as ContentBlock);
			}
		}
		return blocks;
	}

	// 알 수 없는 형태 — 문자열화해서 text 블록으로 보존
	try {
		return [{ type: 'text', text: JSON.stringify(content) } satisfies TextBlock];
	} catch {
		return [];
	}
}

/** tool_use.id ↔ tool_result.tool_use_id 매칭 — tool_use 블록에 result를 붙인다 */
function linkToolResults(messages: RenderMessage[]): void {
	const resultsById = new Map<string, ToolResultBlock>();
	for (const msg of messages) {
		for (const block of msg.content) {
			if (block.type === 'tool_result') {
				const tr = block as ToolResultBlock;
				if (tr.tool_use_id) resultsById.set(tr.tool_use_id, tr);
			}
		}
	}
	for (const msg of messages) {
		for (const block of msg.content) {
			if (block.type === 'tool_use') {
				const tu = block as ToolUseBlock;
				if (tu.id && resultsById.has(tu.id)) {
					tu.result = resultsById.get(tu.id);
				}
			}
		}
	}
}

function toUsageInfo(usage: unknown): UsageInfo | undefined {
	if (!usage || typeof usage !== 'object') return undefined;
	return usage as UsageInfo;
}

function num(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * `.jsonl` transcript 텍스트를 파싱한다.
 * 손상된 라인(비-JSON/파싱 실패)은 skip하고 errors에 기록한다.
 */
export function parseTranscript(text: string): ParseResult {
	const lines = text.split(/\r?\n/);
	const messages: RenderMessage[] = [];
	const errors: ParseError[] = [];

	const models = new Set<string>();
	let sessionId: string | undefined;
	let gitBranch: string | undefined;
	let cwd: string | undefined;
	let version: string | undefined;
	let totalInputTokens = 0;
	let totalOutputTokens = 0;
	let totalCacheCreationTokens = 0;
	let totalCacheReadTokens = 0;
	let firstTimestamp: string | undefined;
	let lastTimestamp: string | undefined;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line || !line.trim()) continue;

		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch (err) {
			errors.push({
				lineIndex: i,
				raw: line.length > 300 ? line.slice(0, 300) + '…' : line,
				error: err instanceof Error ? err.message : String(err)
			});
			continue;
		}

		if (parsed == null || typeof parsed !== 'object') {
			errors.push({ lineIndex: i, raw: line, error: 'not an object' });
			continue;
		}

		try {
			const rec = parsed as Record<string, unknown>;
			const lineType = typeof rec.type === 'string' ? rec.type : 'unknown';
			const messageObj =
				rec.message != null && typeof rec.message === 'object'
					? (rec.message as Record<string, unknown>)
					: {};

			const role = typeof messageObj.role === 'string' ? messageObj.role : lineType;
			const content = normalizeContent(messageObj.content ?? rec.content);
			const timestamp = typeof rec.timestamp === 'string' ? rec.timestamp : undefined;
			const model = typeof messageObj.model === 'string' ? messageObj.model : undefined;
			const usage = toUsageInfo(messageObj.usage);

			const msg: RenderMessage = {
				lineIndex: i,
				lineType,
				role,
				content,
				timestamp,
				model,
				usage,
				cwd: typeof rec.cwd === 'string' ? rec.cwd : undefined,
				gitBranch: typeof rec.gitBranch === 'string' ? rec.gitBranch : undefined,
				sessionId: typeof rec.sessionId === 'string' ? rec.sessionId : undefined,
				parentUuid:
					typeof rec.parentUuid === 'string' || rec.parentUuid === null
						? (rec.parentUuid as string | null)
						: undefined,
				uuid: typeof rec.uuid === 'string' ? rec.uuid : undefined,
				version: typeof rec.version === 'string' ? rec.version : undefined,
				isSidechain: rec.isSidechain === true,
				raw: rec
			};
			messages.push(msg);

			// 메타 집계
			if (model) models.add(model);
			if (!sessionId && msg.sessionId) sessionId = msg.sessionId;
			if (!gitBranch && msg.gitBranch) gitBranch = msg.gitBranch;
			if (!cwd && msg.cwd) cwd = msg.cwd;
			if (!version && msg.version) version = msg.version;
			if (usage) {
				totalInputTokens += num(usage.input_tokens);
				totalOutputTokens += num(usage.output_tokens);
				totalCacheCreationTokens += num(usage.cache_creation_input_tokens);
				totalCacheReadTokens += num(usage.cache_read_input_tokens);
			}
			if (timestamp) {
				if (!firstTimestamp || timestamp < firstTimestamp) firstTimestamp = timestamp;
				if (!lastTimestamp || timestamp > lastTimestamp) lastTimestamp = timestamp;
			}
		} catch (err) {
			// 라인 자체는 유효 JSON이었으나 정규화 중 예외 — skip 후 기록
			errors.push({
				lineIndex: i,
				raw: line.length > 300 ? line.slice(0, 300) + '…' : line,
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}

	linkToolResults(messages);

	const meta: TranscriptMeta = {
		sessionId,
		gitBranch,
		cwd,
		version,
		models: Array.from(models),
		totalMessages: messages.length,
		totalInputTokens,
		totalOutputTokens,
		totalCacheCreationTokens,
		totalCacheReadTokens,
		firstTimestamp,
		lastTimestamp
	};

	return { messages, meta, errors };
}
