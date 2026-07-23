/**
 * Transcript Viewer — 세션 목록/개요용 경량 스캐너
 *
 * `parseTranscript`(전체 메시지 정규화)와 달리, 목록 화면은 파일 전체를 파싱하지
 * 않고 첫 줄/마지막 몇 줄만 훑어 세션 요약(SessionSummary)을 산출한다.
 * `extractSessionSummary`는 순수 문자열 입력만 받아 브라우저 API 의존 없이
 * vitest로 검증 가능하고, `scanClaudeProjectsDirectory`만 File System Access
 * API(`FileSystemDirectoryHandle`)에 의존한다.
 */
import type { ScanFailure, ScanProgress, ScanResult, SessionSummary } from './types.js';

/**
 * File System Access API의 `values()`(디렉터리 순회)와 `Window.showDirectoryPicker`는
 * 이 프로젝트의 TypeScript `lib.dom.d.ts` 번들에 아직 포함되지 않아 로컬로 보강한다.
 */
declare global {
	interface FileSystemDirectoryHandle {
		values(): AsyncIterableIterator<FileSystemHandle>;
	}
	interface Window {
		showDirectoryPicker?: (options?: unknown) => Promise<FileSystemDirectoryHandle>;
	}
}

/** 끝에서부터 스캔할 최대 라인 수 (ai-title/last-prompt/timestamp 탐색용) */
const TAIL_SCAN_LIMIT = 5;

/** 현재 브라우저가 File System Access API(`showDirectoryPicker`)를 지원하는지 여부 */
export function isFileSystemAccessSupported(): boolean {
	return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * `.jsonl` transcript 텍스트에서 목록 표시용 경량 요약을 추출한다.
 * 유효한 JSON 라인이 하나도 없거나 빈 입력이면 `null`을 반환한다.
 * `subagentCount`는 이 함수의 관여 밖이라 항상 `0`으로 초기화되며,
 * `fileHandle`은 `scanClaudeProjectsDirectory`만 채운다.
 */
export function extractSessionSummary(text: string, path: string): SessionSummary | null {
	if (!text.trim()) return null;

	const lines = text.split(/\r?\n/);
	let hasValidLine = false;

	// 첫 유효 JSON 라인에서 cwd/gitBranch/sessionId를 뽑는다
	let cwd: string | undefined;
	let gitBranch: string | undefined;
	let sessionId: string | undefined;
	for (const line of lines) {
		if (!line || !line.trim()) continue;
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			continue;
		}
		if (parsed == null || typeof parsed !== 'object') continue;
		hasValidLine = true;
		const rec = parsed as Record<string, unknown>;
		if (typeof rec.cwd === 'string') cwd = rec.cwd;
		if (typeof rec.gitBranch === 'string') gitBranch = rec.gitBranch;
		if (typeof rec.sessionId === 'string') sessionId = rec.sessionId;
		break;
	}

	// 끝에서부터 역순 최대 TAIL_SCAN_LIMIT줄만 스캔해 ai-title/last-prompt/timestamp를 채운다
	let aiTitle: string | undefined;
	let lastPromptPreview: string | undefined;
	let firstTimestamp: string | undefined;
	let lastTimestamp: string | undefined;
	let scanned = 0;
	for (let i = lines.length - 1; i >= 0 && scanned < TAIL_SCAN_LIMIT; i--) {
		const line = lines[i];
		if (!line || !line.trim()) continue;
		scanned++;
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			continue;
		}
		if (parsed == null || typeof parsed !== 'object') continue;
		hasValidLine = true;
		const rec = parsed as Record<string, unknown>;
		if (!aiTitle && rec.type === 'ai-title' && typeof rec.aiTitle === 'string') aiTitle = rec.aiTitle;
		if (!lastPromptPreview && rec.type === 'last-prompt' && typeof rec.lastPrompt === 'string')
			lastPromptPreview = rec.lastPrompt;
		if (typeof rec.timestamp === 'string') {
			if (!firstTimestamp || rec.timestamp < firstTimestamp) firstTimestamp = rec.timestamp;
			if (!lastTimestamp || rec.timestamp > lastTimestamp) lastTimestamp = rec.timestamp;
		}
	}

	if (!hasValidLine) return null;

	return {
		path,
		sessionId,
		aiTitle,
		lastPromptPreview,
		cwd,
		gitBranch,
		firstTimestamp,
		lastTimestamp,
		subagentCount: 0
	};
}

/** `scanWithProgress` 호출 옵션 */
export interface ScanWithProgressOptions {
	/** 파일 1개 처리(성공/실패 무관)마다 호출되는 진행 콜백 */
	onProgress?: (progress: ScanProgress) => void;
	/** 중도 취소용 신호. abort 시 지금까지의 부분 결과를 `cancelled: true`로 반환한다 */
	signal?: AbortSignal;
	/** 이 스캔 호출을 식별하는 값. 결과의 `ScanResult.generation`에 그대로 전달된다(late-generation 무시 판정은 호출자 소유) */
	generation?: number;
}

/**
 * `~/.claude/projects/` 루트 디렉터리 핸들을 받아 하위 project 폴더를 순회하고,
 * 각 project 폴더 바로 아래 `.jsonl` 세션 파일을 요약해 반환한다.
 * `subagents/` 하위 디렉터리로는 재귀하지 않고, 세션과 동일 이름 폴더 아래
 * `subagents/*.jsonl` 개수만 세어 `subagentCount`에 채운다.
 *
 * `scanWithProgress`의 진행/취소/부분 실패 없는 호환 래퍼 — 기존 시그니처를 보존한다.
 */
export async function scanClaudeProjectsDirectory(
	rootHandle: FileSystemDirectoryHandle
): Promise<SessionSummary[]> {
	const result = await scanWithProgress(rootHandle);
	return result.sessions;
}

/**
 * `scanClaudeProjectsDirectory`의 확장 진입점. 진행 콜백(`onProgress`)·중도 취소
 * (`AbortSignal`)·개별 파일 실패 수집(`ScanFailure[]`)·호출 식별용 `generation`을
 * 지원한다. 개별 `.jsonl` read/parse 실패는 전체 스캔을 중단시키지 않고
 * `ScanResult.failures`에 수집되며, abort 신호 수신 시 그때까지 모은 부분 결과를
 * `cancelled: true`로 반환한다. `fileSize`/`lastModified`는 재스캔 diff의
 * fingerprint 입력으로 각 `SessionSummary`에 채워진다.
 */
export async function scanWithProgress(
	rootHandle: FileSystemDirectoryHandle,
	options: ScanWithProgressOptions = {}
): Promise<ScanResult> {
	const { onProgress, signal, generation = 0 } = options;
	const sessions: SessionSummary[] = [];
	const failures: ScanFailure[] = [];
	let scanned = 0;
	let cancelled = signal?.aborted ?? false;

	scanLoop: for await (const projectEntry of rootHandle.values()) {
		if (signal?.aborted) {
			cancelled = true;
			break;
		}
		if (projectEntry.kind !== 'directory') continue;
		const projectDir = projectEntry as FileSystemDirectoryHandle;

		for await (const entry of projectDir.values()) {
			if (signal?.aborted) {
				cancelled = true;
				break scanLoop;
			}
			if (entry.kind !== 'file' || !entry.name.endsWith('.jsonl')) continue;
			const fileHandle = entry as FileSystemFileHandle;
			const path = `${projectDir.name}/${entry.name}`;

			try {
				const file = await fileHandle.getFile();
				const text = await file.text();
				const summary = extractSessionSummary(text, path);
				scanned++;
				onProgress?.({ scanned, currentPath: path });
				if (!summary) continue;

				const subagentCount = await countSubagentSessions(projectDir, entry.name);
				sessions.push({
					...summary,
					fileHandle,
					subagentCount,
					fileSize: file.size,
					lastModified: file.lastModified
				});
			} catch (err) {
				scanned++;
				failures.push({ path, reason: err instanceof Error ? err.message : String(err) });
				onProgress?.({ scanned, currentPath: path });
			}
		}
	}

	return { sessions, failures, generation, cancelled };
}

/**
 * 세션 파일명(확장자 제외)과 같은 이름의 하위 폴더 아래 `subagents/*.jsonl` 개수를 센다.
 * 해당 폴더/`subagents` 폴더가 없으면 `0`을 반환한다(내용 파싱·드릴다운 없음).
 */
async function countSubagentSessions(
	projectDir: FileSystemDirectoryHandle,
	sessionFileName: string
): Promise<number> {
	const sessionId = sessionFileName.replace(/\.jsonl$/, '');
	try {
		const sessionDir = await projectDir.getDirectoryHandle(sessionId);
		const subagentsDir = await sessionDir.getDirectoryHandle('subagents');
		let count = 0;
		for await (const subEntry of subagentsDir.values()) {
			if (subEntry.kind === 'file' && subEntry.name.endsWith('.jsonl')) count++;
		}
		return count;
	} catch {
		return 0;
	}
}
