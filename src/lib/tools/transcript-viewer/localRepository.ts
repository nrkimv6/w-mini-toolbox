/**
 * Transcript Viewer — 버전 있는 로컬 저장소 (즐겨찾기·최근 폴더)
 *
 * `/claude-sessions` 개인화(즐겨찾기·최근 폴더)를 위한 브라우저 로컬 전용 저장 계층.
 * transcript 본문은 저장하지 않고, 안정 세션 식별자(sessionId 우선, 없으면 path)와
 * schema version만 보관한다. 최근 폴더는 `FileSystemDirectoryHandle`(구조화 복제
 * 가능)을 그대로 저장해 재열기 시 폴더 선택 다이얼로그 없이 권한만 재확인한다.
 *
 * 이 파일은 배치 위치 확정을 위해 세션 목록 소유 계획서(session-overview/catalog)가
 * 만든 `transcript-viewer/`를 따른다 — `sessionCatalog.ts`/`sessionScanner.ts` 등
 * 라우트 중립 순수 로직이 전부 이 디렉터리에 있고, `claude-sessions/`는 라우트
 * 전용 컴포넌트(SessionList.svelte 등)만 두는 관례이기 때문이다(Grep/Glob으로 확인).
 *
 * 계층 분리(브라우저 API 의존 여부에 따른 테스트 가능 경계, sessionScanner.ts와 동일 패턴):
 * - 순수 함수(`evaluateSchemaVersion`, `planRecentFolderUpsert`, `toRepositoryError`,
 *   `resolveFavoriteKey`)는 브라우저 API 없이 vitest만으로 검증 가능하다.
 * - `LocalRepositoryStore` 인터페이스에 의존하는 CRUD 함수(`readFavorites` 등)는
 *   실제 IndexedDB 구현(`createIndexedDbStore`, 브라우저 전용) 또는 테스트용
 *   in-memory 구현을 주입받아 동작하므로, 테스트는 fake store로 실패 유형별 분기를
 *   검증한다(실제 IndexedDB 왕복 자체는 이 child 범위 밖 — post-merge browser T4 소유).
 * - `verifyRecentFolderPermission`은 `queryPermission`을 갖는 duck-typed handle을
 *   받아 동작해 fake handle로 테스트 가능하다.
 */
import type { SessionSummary } from './types.js';

/** 로컬 저장소 실패 유형 */
export type LocalRepositoryErrorKind =
	| 'unsupported'
	| 'quota-exceeded'
	| 'permission-expired'
	| 'unknown-schema-version'
	| 'unknown';

/** 로컬 저장소 실패 정보 */
export interface LocalRepositoryError {
	kind: LocalRepositoryErrorKind;
	message: string;
	/** unknown-schema-version 전용: 저장소에 실제 기록된 버전(읽을 수 있었던 경우) */
	storedVersion?: number;
}

/** 모든 로컬 저장소 연산의 typed result — 실패를 예외로 던지지 않는다 */
export type LocalRepositoryResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: LocalRepositoryError };

function ok<T>(value: T): LocalRepositoryResult<T> {
	return { ok: true, value };
}

function fail<T>(kind: LocalRepositoryErrorKind, message: string, storedVersion?: number): LocalRepositoryResult<T> {
	return { ok: false, error: { kind, message, storedVersion } };
}

/** 현재 스키마 버전. 저장소에 기록된 값과 다르면 읽지 않고 unknown-schema-version을 반환한다 */
export const CURRENT_SCHEMA_VERSION = 1;

/** 즐겨찾기 — transcript 본문 없이 안정 식별자만 보관 */
export interface FavoriteEntry {
	/** 안정 세션 식별자 — resolveFavoriteKey로 산출(sessionId 우선, 없으면 path) */
	sessionKey: string;
	path: string;
	sessionId?: string;
	createdAt: string;
}

/**
 * 즐겨찾기 저장 키를 산출한다. `sessionId`가 있으면 우선 사용하고, 없으면 `path`로
 * fallback한다. 자유텍스트 추론 없이 구조화된 안정 식별자만 사용한다.
 */
export function resolveFavoriteKey(session: Pick<SessionSummary, 'sessionId' | 'path'>): string {
	return session.sessionId?.trim() || session.path;
}

/** 최근 폴더 — 폴더 이름을 dedupe 키로 사용한다(FS Access API는 실제 경로를 노출하지 않음) */
export interface RecentFolderEntry {
	/** dedupe 키 — 폴더 이름(`FileSystemDirectoryHandle.name`)과 동일하게 둔다 */
	id: string;
	name: string;
	handle: FileSystemDirectoryHandle;
	lastOpenedAt: string;
	sessionCount?: number;
}

/** 저장할 최근 폴더 최대 개수 — 초과분은 lastOpenedAt이 오래된 순으로 제거한다 */
export const MAX_RECENT_FOLDERS = 5;

/**
 * 저장소 CRUD 최소 인터페이스. 실제 구현(`createIndexedDbStore`)은 IndexedDB에
 * 위임하고, 테스트는 in-memory 구현을 주입한다. 값은 항상 구조화 복제 가능해야
 * 한다(transcript 본문 같은 대용량/직렬화 불가 데이터는 저장하지 않는다).
 */
export interface LocalRepositoryStore {
	getSchemaVersion(): Promise<number | undefined>;
	setSchemaVersion(version: number): Promise<void>;
	listFavorites(): Promise<FavoriteEntry[]>;
	putFavorite(entry: FavoriteEntry): Promise<void>;
	deleteFavorite(sessionKey: string): Promise<void>;
	listRecentFolders(): Promise<RecentFolderEntry[]>;
	putRecentFolder(entry: RecentFolderEntry): Promise<void>;
	deleteRecentFolder(id: string): Promise<void>;
	clearAll(): Promise<void>;
}

/** 현재 런타임이 IndexedDB를 지원하는지 여부 */
export function isIndexedDbSupported(): boolean {
	return typeof indexedDB !== 'undefined';
}

/**
 * 저장소에 기록된 schema version을 현재 버전과 비교해 판정한다(순수 함수).
 * - `undefined`(신규 저장소) → `'fresh'`로 통과(호출자가 CURRENT_SCHEMA_VERSION을 기록해야 함)
 * - 현재 버전과 일치 → `'current'`로 통과
 * - 그 외(알 수 없는 버전) → 읽지 않고 `unknown-schema-version` 실패 반환
 */
export function evaluateSchemaVersion(storedVersion: number | undefined): LocalRepositoryResult<'fresh' | 'current'> {
	if (storedVersion === undefined) return ok('fresh');
	if (storedVersion === CURRENT_SCHEMA_VERSION) return ok('current');
	return fail('unknown-schema-version', `알 수 없는 로컬 저장소 schema version: ${storedVersion}`, storedVersion);
}

/**
 * 알 수 없는 예외를 typed `LocalRepositoryError`로 분류한다(순수 함수).
 * `QuotaExceededError`는 quota-exceeded로, `NotAllowedError`/`SecurityError`는
 * permission-expired로, 그 외는 unknown으로 분류한다.
 */
export function toRepositoryError(err: unknown): LocalRepositoryError {
	const name = err instanceof DOMException ? err.name : undefined;
	const message = err instanceof Error ? err.message : String(err);

	if (name === 'QuotaExceededError') {
		return { kind: 'quota-exceeded', message };
	}
	if (name === 'NotAllowedError' || name === 'SecurityError') {
		return { kind: 'permission-expired', message };
	}
	return { kind: 'unknown', message };
}

/**
 * 신규/재열기 저장소의 schema version을 확인하고, 신규 저장소면 현재 버전을 기록한다.
 * 알 수 없는 버전이면 데이터를 읽지 않고 실패를 반환한다(호출자가 `resetLocalRepository`로
 * 초기화 action을 제공해야 한다).
 */
export async function openLocalRepository(store: LocalRepositoryStore): Promise<LocalRepositoryResult<LocalRepositoryStore>> {
	try {
		const storedVersion = await store.getSchemaVersion();
		const decision = evaluateSchemaVersion(storedVersion);
		if (!decision.ok) return decision;

		if (decision.value === 'fresh') {
			await store.setSchemaVersion(CURRENT_SCHEMA_VERSION);
		}
		return ok(store);
	} catch (err) {
		return { ok: false, error: toRepositoryError(err) };
	}
}

/** 저장소를 완전히 비우고 현재 schema version으로 재초기화한다(알 수 없는 버전 복구용 초기화 action) */
export async function resetLocalRepository(store: LocalRepositoryStore): Promise<LocalRepositoryResult<void>> {
	try {
		await store.clearAll();
		await store.setSchemaVersion(CURRENT_SCHEMA_VERSION);
		return ok(undefined);
	} catch (err) {
		return { ok: false, error: toRepositoryError(err) };
	}
}

/** 즐겨찾기 목록을 읽는다 */
export async function readFavorites(store: LocalRepositoryStore): Promise<LocalRepositoryResult<FavoriteEntry[]>> {
	try {
		return ok(await store.listFavorites());
	} catch (err) {
		return { ok: false, error: toRepositoryError(err) };
	}
}

/** 세션을 즐겨찾기에 추가한다(이미 있으면 createdAt을 유지하지 않고 덮어쓴다 — 호출자가 필요시 기존 값을 조회해 보존) */
export async function addFavorite(
	store: LocalRepositoryStore,
	session: Pick<SessionSummary, 'sessionId' | 'path'>,
	createdAt: string = new Date().toISOString()
): Promise<LocalRepositoryResult<FavoriteEntry>> {
	const entry: FavoriteEntry = {
		sessionKey: resolveFavoriteKey(session),
		path: session.path,
		sessionId: session.sessionId,
		createdAt
	};
	try {
		await store.putFavorite(entry);
		return ok(entry);
	} catch (err) {
		return { ok: false, error: toRepositoryError(err) };
	}
}

/** 즐겨찾기를 해제한다 */
export async function removeFavorite(store: LocalRepositoryStore, sessionKey: string): Promise<LocalRepositoryResult<void>> {
	try {
		await store.deleteFavorite(sessionKey);
		return ok(undefined);
	} catch (err) {
		return { ok: false, error: toRepositoryError(err) };
	}
}

/** 최근 폴더 목록을 읽는다 */
export async function readRecentFolders(store: LocalRepositoryStore): Promise<LocalRepositoryResult<RecentFolderEntry[]>> {
	try {
		return ok(await store.listRecentFolders());
	} catch (err) {
		return { ok: false, error: toRepositoryError(err) };
	}
}

/**
 * 기존 최근 폴더 목록에 새 항목을 반영한 다음 목록을 계산한다(순수 함수).
 * 같은 `id`(폴더 이름)가 있으면 값을 갱신하고, 없으면 추가한 뒤 `lastOpenedAt` 내림차순
 * (가장 최근 재열기 순)으로 정렬한다. `max`를 초과하면 가장 오래된 항목부터 제거한다.
 */
export function planRecentFolderUpsert(
	existing: RecentFolderEntry[],
	next: RecentFolderEntry,
	max: number = MAX_RECENT_FOLDERS
): RecentFolderEntry[] {
	const merged = [next, ...existing.filter((entry) => entry.id !== next.id)];
	const sortedByRecency = [...merged].sort((a, b) => (a.lastOpenedAt < b.lastOpenedAt ? 1 : a.lastOpenedAt > b.lastOpenedAt ? -1 : 0));
	return sortedByRecency.slice(0, max);
}

/** 최근 폴더를 기록/갱신한다(MAX_RECENT_FOLDERS 초과 시 오래된 항목을 정리한다) */
export async function upsertRecentFolder(
	store: LocalRepositoryStore,
	entry: RecentFolderEntry
): Promise<LocalRepositoryResult<RecentFolderEntry[]>> {
	try {
		const existing = await store.listRecentFolders();
		const planned = planRecentFolderUpsert(existing, entry);

		const keepIds = new Set(planned.map((item) => item.id));
		for (const item of existing) {
			if (!keepIds.has(item.id)) await store.deleteRecentFolder(item.id);
		}
		await store.putRecentFolder(entry);

		return ok(planned);
	} catch (err) {
		return { ok: false, error: toRepositoryError(err) };
	}
}

/** 최근 폴더 기록 1건을 삭제한다 */
export async function removeRecentFolder(store: LocalRepositoryStore, id: string): Promise<LocalRepositoryResult<void>> {
	try {
		await store.deleteRecentFolder(id);
		return ok(undefined);
	} catch (err) {
		return { ok: false, error: toRepositoryError(err) };
	}
}

/** 최근 폴더 기록 전체를 삭제한다(즐겨찾기·schema version은 유지) */
export async function clearRecentFolders(store: LocalRepositoryStore): Promise<LocalRepositoryResult<void>> {
	try {
		const existing = await store.listRecentFolders();
		for (const item of existing) await store.deleteRecentFolder(item.id);
		return ok(undefined);
	} catch (err) {
		return { ok: false, error: toRepositoryError(err) };
	}
}

/**
 * File System Access API의 `queryPermission`을 이 파일 로컬로 보강한다
 * (sessionScanner.ts의 `declare global` 보강과 동일한 사유 — lib.dom.d.ts 미포함).
 */
declare global {
	interface FileSystemHandle {
		queryPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
	}
}

/**
 * 저장된 최근 폴더 핸들의 읽기 권한이 아직 유효한지 확인한다.
 * `queryPermission`이 없는 handle(구현 미지원)은 `unknown` 실패로 분류한다.
 */
export async function verifyRecentFolderPermission(
	handle: Pick<FileSystemDirectoryHandle, 'queryPermission'>
): Promise<LocalRepositoryResult<'granted'>> {
	if (!handle.queryPermission) {
		return fail('unknown', '이 브라우저는 queryPermission을 지원하지 않는다');
	}
	try {
		const state = await handle.queryPermission({ mode: 'read' });
		if (state === 'granted') return ok('granted');
		return fail('permission-expired', `permission state: ${state}`);
	} catch (err) {
		return { ok: false, error: toRepositoryError(err) };
	}
}

/**
 * 브라우저 IndexedDB에 위임하는 실제 `LocalRepositoryStore` 구현.
 * `scanClaudeProjectsDirectory`와 동일하게 브라우저 API 전용이라 vitest 대상이
 * 아니며(post-merge browser T4 소유), 순수 CRUD 로직은 위 함수들이 담당한다.
 */
export function createIndexedDbStore(dbName = 'transcript-viewer-local-repository'): Promise<LocalRepositoryStore> {
	return new Promise((resolve, reject) => {
		if (!isIndexedDbSupported()) {
			reject(new Error('IndexedDB unsupported'));
			return;
		}

		const request = indexedDB.open(dbName, 1);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
			if (!db.objectStoreNames.contains('favorites')) db.createObjectStore('favorites', { keyPath: 'sessionKey' });
			if (!db.objectStoreNames.contains('recentFolders')) db.createObjectStore('recentFolders', { keyPath: 'id' });
		};
		request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
		request.onsuccess = () => {
			const db = request.result;
			resolve(wrapIndexedDb(db));
		};
	});
}

function wrapIndexedDb(db: IDBDatabase): LocalRepositoryStore {
	function tx<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(storeName, mode);
			const store = transaction.objectStore(storeName);
			const request = run(store);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error ?? new Error(`IndexedDB ${storeName} operation failed`));
		});
	}

	function txAll<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => void): Promise<T> {
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(storeName, mode);
			const store = transaction.objectStore(storeName);
			run(store);
			transaction.oncomplete = () => resolve(undefined as T);
			transaction.onerror = () => reject(transaction.error ?? new Error(`IndexedDB ${storeName} transaction failed`));
		});
	}

	return {
		async getSchemaVersion() {
			return tx<number | undefined>('meta', 'readonly', (store) => store.get('schemaVersion'));
		},
		async setSchemaVersion(version) {
			await txAll('meta', 'readwrite', (store) => {
				store.put(version, 'schemaVersion');
			});
		},
		async listFavorites() {
			return tx<FavoriteEntry[]>('favorites', 'readonly', (store) => store.getAll());
		},
		async putFavorite(entry) {
			await txAll('favorites', 'readwrite', (store) => {
				store.put(entry);
			});
		},
		async deleteFavorite(sessionKey) {
			await txAll('favorites', 'readwrite', (store) => {
				store.delete(sessionKey);
			});
		},
		async listRecentFolders() {
			return tx<RecentFolderEntry[]>('recentFolders', 'readonly', (store) => store.getAll());
		},
		async putRecentFolder(entry) {
			await txAll('recentFolders', 'readwrite', (store) => {
				store.put(entry);
			});
		},
		async deleteRecentFolder(id) {
			await txAll('recentFolders', 'readwrite', (store) => {
				store.delete(id);
			});
		},
		async clearAll() {
			await txAll('meta', 'readwrite', (store) => store.clear());
			await txAll('favorites', 'readwrite', (store) => store.clear());
			await txAll('recentFolders', 'readwrite', (store) => store.clear());
		}
	};
}
