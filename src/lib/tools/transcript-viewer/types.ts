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
	/** ai-title 라인의 제목 */
	aiTitle?: string;
	/** last-prompt 라인의 마지막 사용자 질문 미리보기 */
	lastPromptPreview?: string;
	/** system/away_summary 라인의 이탈 요약 */
	awaySummary?: string;
	/** 라인에 포함된 slug 값 */
	slug?: string;
}

/** 세션 목록/개요 뷰에서 사용하는 경량 세션 요약 (전체 파싱 없이 산출) */
export interface SessionSummary {
	path: string;
	sessionId?: string;
	aiTitle?: string;
	lastPromptPreview?: string;
	cwd?: string;
	gitBranch?: string;
	firstTimestamp?: string;
	lastTimestamp?: string;
	subagentCount: number;
	/** 목록 → 상세 진입 시 파일을 다시 열기 위한 참조. extractSessionSummary는 채우지 않고 scanClaudeProjectsDirectory만 채운다(직렬화·저장 대상 아님) */
	fileHandle?: FileSystemFileHandle;
	/** 재스캔 diff의 fingerprint 입력 — extractSessionSummary는 채우지 않고 스캔 확장 진입점만 채운다 */
	fileSize?: number;
	/** 재스캔 diff의 fingerprint 입력(epoch ms) — extractSessionSummary는 채우지 않고 스캔 확장 진입점만 채운다 */
	lastModified?: number;
}

/** parseTranscript 반환 타입 */
export interface ParseResult {
	messages: RenderMessage[];
	meta: TranscriptMeta;
	errors: ParseError[];
}

/** 세션 목록 스캔 진행 상황 */
export interface ScanProgress {
	/** 지금까지 스캔한 파일 수 */
	scanned: number;
	/** 스캔 대상 전체 파일 수(사전에 알 수 없으면 undefined) */
	total?: number;
	/** 현재 처리 중인 파일 경로 */
	currentPath?: string;
}

/** 개별 파일 read/parse 실패 정보 (스캔 전체를 중단시키지 않는다) */
export interface ScanFailure {
	path: string;
	reason: string;
}

/** 스캔 확장 진입점(`scanWithProgress` 등)의 결과 */
export interface ScanResult {
	sessions: SessionSummary[];
	failures: ScanFailure[];
	/** 이 스캔 호출을 식별하는 generation 값. 호출자가 부여해 late-generation 결과를 무시하는 데 사용한다(무시 판정 자체는 UI 계층 소유) */
	generation: number;
	/** AbortSignal로 중도 취소됐는지 여부. true면 sessions/failures는 부분 결과다 */
	cancelled: boolean;
}

/** 재스캔 시 이전/다음 카탈로그를 비교한 diff 결과 */
export interface CatalogDiff {
	added: string[];
	changed: string[];
	removed: string[];
}

/** querySessions가 메모·태그 검색에 사용하는 annotation 최소 형태 */
export interface SessionQueryAnnotation {
	note: string;
	tags: string[];
}

/** querySessions 검색 조건 */
export interface SessionQuery {
	/** 제목/프로젝트(cwd)/브랜치/sessionId 다중 필드 부분일치(대소문자 무시) */
	text?: string;
	/**
	 * 메모·태그 검색 대상 — sessionKey(localRepository.ts의 resolveFavoriteKey와 동일 규칙)
	 * → annotation 매핑. 지정하지 않으면 메모/태그 검색을 건너뛴다(P1 호출자 하위호환).
	 */
	annotations?: Map<string, SessionQueryAnnotation> | Record<string, SessionQueryAnnotation>;
	/** true면 `text` 검색 대상에 annotation.note/tags도 포함한다(기본 false) */
	includeAnnotationText?: boolean;
	/** 태그 조건(AND) — 연결된 annotation.tags가 이 태그를 모두 포함해야 통과(대소문자 무시) */
	tags?: string[];
}

/** sortSessions 정렬 기준 키 */
export type SessionSortKey = 'lastActivity' | 'title' | 'messageCount';

/** sortSessions 정렬 방향 */
export type SortDirection = 'asc' | 'desc';
