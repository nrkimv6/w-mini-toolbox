/**
 * Transcript Viewer — 타입 정의
 *
 * Claude Code가 남기는 `.jsonl` transcript(JSON Lines) 포맷을 파싱한 결과를
 * 렌더링하기 위한 데이터 모델. 원본 라인 스키마는 안정적이지 않으므로
 * 필드는 최대한 optional로 둔다.
 */

/** JSONL 한 라인의 최상위 type 값 */
export type TranscriptLineType =
	| 'user'
	| 'assistant'
	| 'system'
	| 'attachment'
	| 'mode'
	| 'file-history-snapshot'
	| 'ai-title'
	| 'last-prompt'
	| 'queue-operation'
	| (string & {});

/** content 블록 — text */
export interface TextBlock {
	type: 'text';
	text: string;
}

/** content 블록 — thinking (기본 접힘) */
export interface ThinkingBlock {
	type: 'thinking';
	thinking: string;
	signature?: string;
}

/** content 블록 — tool_use */
export interface ToolUseBlock {
	type: 'tool_use';
	id: string;
	name: string;
	input?: unknown;
	caller?: string;
	/** 매칭된 tool_result (파서가 후처리로 채워 넣음) */
	result?: ToolResultBlock;
}

/** content 블록 — tool_result */
export interface ToolResultBlock {
	type: 'tool_result';
	tool_use_id: string;
	content: unknown;
	is_error?: boolean;
}

/** 정규화 이전에는 알 수 없는 기타 블록 타입도 허용 */
export interface UnknownBlock {
	type: string;
	[key: string]: unknown;
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock | UnknownBlock;

/** message.usage 토큰 정보 (모델별로 필드가 다를 수 있어 optional) */
export interface UsageInfo {
	input_tokens?: number;
	output_tokens?: number;
	cache_creation_input_tokens?: number;
	cache_read_input_tokens?: number;
	[key: string]: unknown;
}

/**
 * 파싱 + 정규화된 렌더용 메시지.
 * 원본 라인(type: user/assistant/system 등) 1개가 RenderMessage 1개로 매핑된다.
 */
export interface RenderMessage {
	/** 파일 내 라인 인덱스 (0-based) — 디버깅/네비게이션용 */
	lineIndex: number;
	/** 원본 line.type */
	lineType: TranscriptLineType;
	/** message.role (user/assistant/system 등, 없으면 lineType으로 대체) */
	role: string;
	/** 정규화된 content 블록 목록 */
	content: ContentBlock[];
	timestamp?: string;
	model?: string;
	usage?: UsageInfo;
	cwd?: string;
	gitBranch?: string;
	sessionId?: string;
	parentUuid?: string | null;
	uuid?: string;
	version?: string;
	isSidechain?: boolean;
	/** 라인 subtype (system 라인의 'compact_boundary' 등) */
	subtype?: string;
	/** compact 요약 발언(이전 대화 이어받기) 여부 */
	isCompactSummary?: boolean;
	/** 시스템 메타 라인 여부 */
	isMeta?: boolean;
	/** 원본 라인 객체 (알 수 없는 필드 참조용) */
	raw: Record<string, unknown>;
}

/** parseTranscript 실패 라인 정보 */
export interface ParseError {
	lineIndex: number;
	raw: string;
	error: string;
}

/** 세션 전체 메타 집계 */
export interface TranscriptMeta {
	sessionId?: string;
	gitBranch?: string;
	cwd?: string;
	version?: string;
	models: string[];
	totalMessages: number;
	totalInputTokens: number;
	totalOutputTokens: number;
	totalCacheCreationTokens: number;
	totalCacheReadTokens: number;
	firstTimestamp?: string;
	lastTimestamp?: string;
}

/** parseTranscript 반환 타입 */
export interface ParseResult {
	messages: RenderMessage[];
	meta: TranscriptMeta;
	errors: ParseError[];
}
