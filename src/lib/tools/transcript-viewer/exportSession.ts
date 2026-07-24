/**
 * Transcript Viewer — 세션 내보내기(Markdown/JSON)
 *
 * 파싱된 세션(`RenderMessage[]` + `TranscriptMeta`)을 사람이 읽을 수 있는
 * Markdown 또는 구조화된 JSON으로 직렬화한다. 민감할 수 있는 정보(메시지 본문,
 * thinking 내용, 전체 경로)는 기본값에서 제외하고, 호출자가 명시적으로 opt-in한
 * 경우에만 포함한다. `buildSessionExport`는 순수 함수(브라우저 API 없음)라
 * vitest로 검증 가능하다. 실제 다운로드 트리거(`downloadSessionExport`)는
 * `Blob`/`URL.createObjectURL`/DOM 앵커 클릭에 의존하는 브라우저 전용 함수라
 * (sessionScanner.ts의 `scanClaudeProjectsDirectory`, localRepository.ts의
 * `createIndexedDbStore`와 동일 사유) vitest 대상이 아니다(post-merge browser T4 소유).
 */
import type { RenderMessage, SessionSummary, TranscriptMeta, ToolUseBlock } from './types.js';

/** 내보내기 형식 */
export type ExportFormat = 'markdown' | 'json';

/** 내보내기 대상 — 세션 요약(제목/경로) + 전체 파싱 결과 */
export interface ExportSelection {
	session: Pick<SessionSummary, 'path' | 'sessionId' | 'aiTitle' | 'cwd' | 'gitBranch'>;
	meta: TranscriptMeta;
	messages: RenderMessage[];
}

/** 내보내기 옵션 — 민감 필드는 전부 opt-in(기본 false) */
export interface ExportOptions {
	format: ExportFormat;
	/** 메시지 본문(text) 포함 여부. 기본 false */
	includeBody?: boolean;
	/** thinking 블록 포함 여부. includeBody가 false면 무시된다(본문이 없으면 thinking도 없음). 기본 false */
	includeThinking?: boolean;
	/** cwd/path 같은 로컬 전체 경로 포함 여부. 기본 false */
	includeFullPaths?: boolean;
	/** 파일명 지정(확장자 제외). 미지정 시 aiTitle → sessionId → 'session' 순으로 생성한다 */
	filename?: string;
}

/** buildSessionExport 성공 결과 */
export interface ExportSuccess {
	ok: true;
	filename: string;
	content: string;
	mimeType: string;
}

/** buildSessionExport 실패 결과 */
export interface ExportFailure {
	ok: false;
	error: string;
}

export type ExportBuildResult = ExportSuccess | ExportFailure;

const EXTENSION_BY_FORMAT: Record<ExportFormat, string> = {
	markdown: 'md',
	json: 'json'
};

const MIME_BY_FORMAT: Record<ExportFormat, string> = {
	markdown: 'text/markdown;charset=utf-8',
	json: 'application/json;charset=utf-8'
};

/** 파일명에 쓸 수 없는 문자를 `-`로 치환하고 중복/양끝 `-`를 정리한다. 결과가 비면 'session'으로 fallback한다 */
function normalizeFilenameBase(raw: string): string {
	const replaced = raw
		.trim()
		.replace(/[\\/:*?"<>|]/g, '-')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-+|-+$/g, '');
	return replaced || 'session';
}

function buildFilename(selection: ExportSelection, options: ExportOptions): string {
	const extension = EXTENSION_BY_FORMAT[options.format];
	const base = options.filename ?? selection.session.aiTitle ?? selection.session.sessionId ?? 'session';
	return `${normalizeFilenameBase(base)}.${extension}`;
}

/** 세션 표시용 제목 — aiTitle → sessionId → path → '(제목 없음)' 순 */
function sessionTitle(session: ExportSelection['session']): string {
	return session.aiTitle || session.sessionId || session.path || '(제목 없음)';
}

/** text 블록만 이어붙여 메시지 본문 텍스트를 만든다(thinking은 별도 포함 여부로 판단) */
function messageBodyText(message: RenderMessage, includeThinking: boolean): string {
	const parts: string[] = [];
	for (const block of message.content) {
		if (block.type === 'text') parts.push(block.text);
		else if (includeThinking && block.type === 'thinking') parts.push(`[thinking] ${block.thinking}`);
		else if (block.type === 'tool_use') {
			const tu = block as ToolUseBlock;
			parts.push(`[tool_use] ${tu.name}`);
		}
	}
	return parts.join('\n').trim();
}

function buildMarkdown(selection: ExportSelection, options: ExportOptions): string {
	const { session, meta } = selection;
	const includeBody = options.includeBody === true;
	const includeThinking = options.includeThinking === true;
	const includeFullPaths = options.includeFullPaths === true;

	const lines: string[] = [];
	lines.push(`# ${sessionTitle(session)}`);
	lines.push('');
	if (session.sessionId) lines.push(`- Session ID: ${session.sessionId}`);
	lines.push(`- Messages: ${meta.totalMessages}`);
	lines.push(`- Models: ${meta.models.length > 0 ? meta.models.join(', ') : '(없음)'}`);
	lines.push(
		`- Tokens: input ${meta.totalInputTokens} / output ${meta.totalOutputTokens} / cache-create ${meta.totalCacheCreationTokens} / cache-read ${meta.totalCacheReadTokens}`
	);
	if (meta.firstTimestamp || meta.lastTimestamp) {
		lines.push(`- Range: ${meta.firstTimestamp ?? '?'} ~ ${meta.lastTimestamp ?? '?'}`);
	}
	if (includeFullPaths) {
		if (session.path) lines.push(`- Path: ${session.path}`);
		if (session.cwd) lines.push(`- Cwd: ${session.cwd}`);
	}
	if (session.gitBranch) lines.push(`- Branch: ${session.gitBranch}`);

	if (includeBody) {
		lines.push('');
		lines.push('## Messages');
		for (const message of selection.messages) {
			const body = messageBodyText(message, includeThinking);
			if (!body) continue;
			lines.push('');
			lines.push(`### [${message.lineIndex}] ${message.role}${message.timestamp ? ` — ${message.timestamp}` : ''}`);
			lines.push(body);
		}
	}

	return lines.join('\n') + '\n';
}

function buildJson(selection: ExportSelection, options: ExportOptions): string {
	const { session, meta } = selection;
	const includeBody = options.includeBody === true;
	const includeThinking = options.includeThinking === true;
	const includeFullPaths = options.includeFullPaths === true;

	const payload: Record<string, unknown> = {
		title: sessionTitle(session),
		sessionId: session.sessionId,
		gitBranch: session.gitBranch,
		totalMessages: meta.totalMessages,
		models: meta.models,
		tokens: {
			input: meta.totalInputTokens,
			output: meta.totalOutputTokens,
			cacheCreate: meta.totalCacheCreationTokens,
			cacheRead: meta.totalCacheReadTokens
		},
		firstTimestamp: meta.firstTimestamp,
		lastTimestamp: meta.lastTimestamp
	};

	if (includeFullPaths) {
		payload.path = session.path;
		payload.cwd = session.cwd;
	}

	if (includeBody) {
		payload.messages = selection.messages.map((message) => ({
			lineIndex: message.lineIndex,
			role: message.role,
			timestamp: message.timestamp,
			body: messageBodyText(message, includeThinking)
		}));
	}

	return JSON.stringify(payload, null, 2);
}

/**
 * 세션 선택 범위와 옵션으로 Markdown 또는 JSON 내보내기 콘텐츠를 만든다.
 * 기본값(모든 include* 옵션 미지정/false)에서는 메시지 본문·thinking·전체 경로가
 * 전부 제외된 메타 요약만 만든다. 지원하지 않는 `format` 값이면 typed 실패를 반환한다.
 */
export function buildSessionExport(selection: ExportSelection, options: ExportOptions): ExportBuildResult {
	if (options.format !== 'markdown' && options.format !== 'json') {
		return { ok: false, error: `지원하지 않는 내보내기 형식: ${String(options.format)}` };
	}

	const filename = buildFilename(selection, options);
	const content = options.format === 'markdown' ? buildMarkdown(selection, options) : buildJson(selection, options);
	const mimeType = MIME_BY_FORMAT[options.format];

	return { ok: true, filename, content, mimeType };
}

/**
 * `buildSessionExport` 결과를 실제 파일 다운로드로 트리거한다(브라우저 전용).
 * `Blob` → `URL.createObjectURL` → 숨김 `<a>` 클릭 → `URL.revokeObjectURL` 순으로
 * 처리해 object URL을 누수 없이 정리한다. 성공/실패를 typed 결과로 반환하며 던지지 않는다.
 */
export function downloadSessionExport(result: ExportSuccess): { ok: true } | { ok: false; error: string } {
	if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
		return { ok: false, error: '브라우저 환경이 아니라 다운로드를 트리거할 수 없다' };
	}
	try {
		const blob = new Blob([result.content], { type: result.mimeType });
		const url = URL.createObjectURL(blob);
		try {
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = result.filename;
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);
		} finally {
			URL.revokeObjectURL(url);
		}
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}
