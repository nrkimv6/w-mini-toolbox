/**
 * Unit Tests for Transcript Viewer local repository (즐겨찾기·최근 폴더)
 *
 * 실제 IndexedDB(`createIndexedDbStore`/`wrapIndexedDb`)는 브라우저 전용이라
 * (sessionScanner.ts의 `scanClaudeProjectsDirectory`와 동일 사유) 여기서 테스트하지
 * 않는다 — post-merge browser T4가 실제 IndexedDB 왕복을 검증한다.
 * 이 파일은 `LocalRepositoryStore` 인터페이스를 만족하는 in-memory fake와, 브라우저
 * API 의존 없는 순수 함수(evaluateSchemaVersion/planRecentFolderUpsert/toRepositoryError
 * /resolveFavoriteKey)를 검증한다. fixture 범위: 신규 저장소, 재열기, schema 불일치,
 * 삭제, 저장 실패(quota/permission).
 */
import { describe, it, expect } from 'vitest';
import {
	CURRENT_SCHEMA_VERSION,
	evaluateSchemaVersion,
	openLocalRepository,
	resetLocalRepository,
	resolveFavoriteKey,
	readFavorites,
	addFavorite,
	removeFavorite,
	readRecentFolders,
	upsertRecentFolder,
	removeRecentFolder,
	clearRecentFolders,
	planRecentFolderUpsert,
	toRepositoryError,
	verifyRecentFolderPermission,
	type FavoriteEntry,
	type LocalRepositoryStore,
	type RecentFolderEntry
} from './localRepository.js';

/** in-memory fake `LocalRepositoryStore` — 실패 유형 주입을 위해 옵션으로 throw 지점을 지정할 수 있다 */
function fakeStore(
	options: {
		schemaVersion?: number;
		favorites?: FavoriteEntry[];
		recentFolders?: RecentFolderEntry[];
		throwOn?: { op: 'putFavorite' | 'putRecentFolder'; error: unknown };
	} = {}
): LocalRepositoryStore {
	let schemaVersion = options.schemaVersion;
	let favorites = [...(options.favorites ?? [])];
	let recentFolders = [...(options.recentFolders ?? [])];

	return {
		async getSchemaVersion() {
			return schemaVersion;
		},
		async setSchemaVersion(version) {
			schemaVersion = version;
		},
		async listFavorites() {
			return favorites;
		},
		async putFavorite(entry) {
			if (options.throwOn?.op === 'putFavorite') throw options.throwOn.error;
			favorites = [...favorites.filter((f) => f.sessionKey !== entry.sessionKey), entry];
		},
		async deleteFavorite(sessionKey) {
			favorites = favorites.filter((f) => f.sessionKey !== sessionKey);
		},
		async listRecentFolders() {
			return recentFolders;
		},
		async putRecentFolder(entry) {
			if (options.throwOn?.op === 'putRecentFolder') throw options.throwOn.error;
			recentFolders = [...recentFolders.filter((f) => f.id !== entry.id), entry];
		},
		async deleteRecentFolder(id) {
			recentFolders = recentFolders.filter((f) => f.id !== id);
		},
		async clearAll() {
			schemaVersion = undefined;
			favorites = [];
			recentFolders = [];
		}
	};
}

function fakeDirHandle(name: string): FileSystemDirectoryHandle {
	return { kind: 'directory', name } as unknown as FileSystemDirectoryHandle;
}

describe('resolveFavoriteKey', () => {
	it('sessionId가 있으면 sessionId를 우선 사용한다', () => {
		expect(resolveFavoriteKey({ sessionId: 'sess-1', path: 'p1/sess-1.jsonl' })).toBe('sess-1');
	});

	it('sessionId가 없으면 path로 fallback한다', () => {
		expect(resolveFavoriteKey({ path: 'p1/sess-1.jsonl' })).toBe('p1/sess-1.jsonl');
	});

	it('sessionId가 공백 문자열이면 path로 fallback한다', () => {
		expect(resolveFavoriteKey({ sessionId: '   ', path: 'p1/sess-1.jsonl' })).toBe('p1/sess-1.jsonl');
	});
});

describe('evaluateSchemaVersion', () => {
	it('버전이 없으면(신규 저장소) fresh로 통과시킨다', () => {
		const result = evaluateSchemaVersion(undefined);
		expect(result).toEqual({ ok: true, value: 'fresh' });
	});

	it('현재 버전과 일치하면 current로 통과시킨다', () => {
		const result = evaluateSchemaVersion(CURRENT_SCHEMA_VERSION);
		expect(result).toEqual({ ok: true, value: 'current' });
	});

	it('알 수 없는 버전이면 unknown-schema-version 실패를 반환하고 storedVersion을 포함한다', () => {
		const result = evaluateSchemaVersion(999);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.kind).toBe('unknown-schema-version');
			expect(result.error.storedVersion).toBe(999);
		}
	});
});

describe('toRepositoryError', () => {
	it('QuotaExceededError를 quota-exceeded로 분류한다', () => {
		const err = new DOMException('quota', 'QuotaExceededError');
		expect(toRepositoryError(err).kind).toBe('quota-exceeded');
	});

	it('NotAllowedError를 permission-expired로 분류한다', () => {
		const err = new DOMException('denied', 'NotAllowedError');
		expect(toRepositoryError(err).kind).toBe('permission-expired');
	});

	it('SecurityError를 permission-expired로 분류한다', () => {
		const err = new DOMException('blocked', 'SecurityError');
		expect(toRepositoryError(err).kind).toBe('permission-expired');
	});

	it('알 수 없는 에러는 unknown으로 분류한다', () => {
		expect(toRepositoryError(new Error('boom')).kind).toBe('unknown');
		expect(toRepositoryError('plain string').kind).toBe('unknown');
	});
});

describe('openLocalRepository', () => {
	it('신규 저장소(버전 없음)를 열면 현재 schema version을 기록하고 ok를 반환한다', async () => {
		const store = fakeStore();
		const result = await openLocalRepository(store);

		expect(result.ok).toBe(true);
		expect(await store.getSchemaVersion()).toBe(CURRENT_SCHEMA_VERSION);
	});

	it('재열기(이미 현재 버전)는 값을 건드리지 않고 ok를 반환한다', async () => {
		const store = fakeStore({ schemaVersion: CURRENT_SCHEMA_VERSION, favorites: [{ sessionKey: 's1', path: 'p1', createdAt: 't' }] });
		const result = await openLocalRepository(store);

		expect(result.ok).toBe(true);
		expect(await store.listFavorites()).toHaveLength(1);
	});

	it('알 수 없는 schema version은 데이터를 읽지 않고 unknown-schema-version 실패를 반환한다', async () => {
		const store = fakeStore({ schemaVersion: 42, favorites: [{ sessionKey: 's1', path: 'p1', createdAt: 't' }] });
		const result = await openLocalRepository(store);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.kind).toBe('unknown-schema-version');
			expect(result.error.storedVersion).toBe(42);
		}
		// 실패 시 기존 데이터가 그대로 남아있어야 한다(읽지 않음 == 건드리지 않음)
		expect(await store.listFavorites()).toHaveLength(1);
	});
});

describe('resetLocalRepository', () => {
	it('초기화 action은 전체를 비우고 현재 schema version을 다시 기록한다', async () => {
		const store = fakeStore({
			schemaVersion: 42,
			favorites: [{ sessionKey: 's1', path: 'p1', createdAt: 't' }],
			recentFolders: [{ id: 'proj', name: 'proj', handle: fakeDirHandle('proj'), lastOpenedAt: 't' }]
		});

		const result = await resetLocalRepository(store);

		expect(result.ok).toBe(true);
		expect(await store.getSchemaVersion()).toBe(CURRENT_SCHEMA_VERSION);
		expect(await store.listFavorites()).toEqual([]);
		expect(await store.listRecentFolders()).toEqual([]);
	});
});

describe('favorites CRUD', () => {
	it('addFavorite/readFavorites/removeFavorite 왕복이 동작한다', async () => {
		const store = fakeStore();

		const added = await addFavorite(store, { sessionId: 'sess-1', path: 'p1/sess-1.jsonl' }, '2026-07-23T00:00:00Z');
		expect(added).toEqual({ ok: true, value: { sessionKey: 'sess-1', path: 'p1/sess-1.jsonl', sessionId: 'sess-1', createdAt: '2026-07-23T00:00:00Z' } });

		const read = await readFavorites(store);
		expect(read).toEqual({ ok: true, value: [{ sessionKey: 'sess-1', path: 'p1/sess-1.jsonl', sessionId: 'sess-1', createdAt: '2026-07-23T00:00:00Z' }] });

		const removed = await removeFavorite(store, 'sess-1');
		expect(removed).toEqual({ ok: true, value: undefined });
		expect(await readFavorites(store)).toEqual({ ok: true, value: [] });
	});

	it('저장 실패(quota) 시 addFavorite이 typed 실패를 반환하고 던지지 않는다', async () => {
		const store = fakeStore({ throwOn: { op: 'putFavorite', error: new DOMException('full', 'QuotaExceededError') } });

		const result = await addFavorite(store, { sessionId: 'sess-1', path: 'p1' });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe('quota-exceeded');
	});
});

describe('planRecentFolderUpsert', () => {
	function entry(id: string, lastOpenedAt: string): RecentFolderEntry {
		return { id, name: id, handle: fakeDirHandle(id), lastOpenedAt };
	}

	it('신규 항목을 맨 앞에 추가한다', () => {
		const result = planRecentFolderUpsert([entry('a', '2026-07-20T00:00:00Z')], entry('b', '2026-07-23T00:00:00Z'));
		expect(result.map((e) => e.id)).toEqual(['b', 'a']);
	});

	it('같은 id를 다시 열면 맨 앞으로 이동하고 값을 갱신한다(중복 없음)', () => {
		const result = planRecentFolderUpsert(
			[entry('a', '2026-07-20T00:00:00Z'), entry('b', '2026-07-21T00:00:00Z')],
			entry('a', '2026-07-23T00:00:00Z')
		);
		expect(result.map((e) => e.id)).toEqual(['a', 'b']);
		expect(result[0].lastOpenedAt).toBe('2026-07-23T00:00:00Z');
	});

	it('max 초과 시 lastOpenedAt이 가장 오래된 항목을 제거한다', () => {
		const existing = [
			entry('a', '2026-07-19T00:00:00Z'),
			entry('b', '2026-07-20T00:00:00Z'),
			entry('c', '2026-07-21T00:00:00Z')
		];
		const result = planRecentFolderUpsert(existing, entry('d', '2026-07-23T00:00:00Z'), 3);

		expect(result).toHaveLength(3);
		expect(result.map((e) => e.id)).toEqual(['d', 'c', 'b']);
		expect(result.some((e) => e.id === 'a')).toBe(false);
	});
});

describe('recent folders CRUD', () => {
	it('upsertRecentFolder/readRecentFolders/removeRecentFolder/clearRecentFolders 왕복이 동작한다', async () => {
		const store = fakeStore();

		const upserted = await upsertRecentFolder(store, {
			id: 'proj',
			name: 'proj',
			handle: fakeDirHandle('proj'),
			lastOpenedAt: '2026-07-23T00:00:00Z',
			sessionCount: 3
		});
		expect(upserted.ok).toBe(true);

		const read = await readRecentFolders(store);
		expect(read.ok).toBe(true);
		if (read.ok) expect(read.value).toHaveLength(1);

		const removed = await removeRecentFolder(store, 'proj');
		expect(removed).toEqual({ ok: true, value: undefined });
		expect(await readRecentFolders(store)).toEqual({ ok: true, value: [] });
	});

	it('upsertRecentFolder는 max 초과 시 오래된 기록을 저장소에서도 제거한다', async () => {
		const store = fakeStore({
			recentFolders: [
				{ id: 'a', name: 'a', handle: fakeDirHandle('a'), lastOpenedAt: '2026-07-19T00:00:00Z' },
				{ id: 'b', name: 'b', handle: fakeDirHandle('b'), lastOpenedAt: '2026-07-20T00:00:00Z' },
				{ id: 'c', name: 'c', handle: fakeDirHandle('c'), lastOpenedAt: '2026-07-21T00:00:00Z' },
				{ id: 'd', name: 'd', handle: fakeDirHandle('d'), lastOpenedAt: '2026-07-22T00:00:00Z' },
				{ id: 'e', name: 'e', handle: fakeDirHandle('e'), lastOpenedAt: '2026-07-23T00:00:00Z' }
			]
		});

		const result = await upsertRecentFolder(store, {
			id: 'f',
			name: 'f',
			handle: fakeDirHandle('f'),
			lastOpenedAt: '2026-07-24T00:00:00Z'
		});

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.map((e) => e.id)).toEqual(['f', 'e', 'd', 'c', 'b']);

		const persisted = await readRecentFolders(store);
		expect(persisted.ok).toBe(true);
		if (persisted.ok) {
			expect(persisted.value.map((e) => e.id).sort()).toEqual(['b', 'c', 'd', 'e', 'f']);
		}
	});

	it('clearRecentFolders는 최근 폴더 전체를 지우고 즐겨찾기는 유지한다', async () => {
		const store = fakeStore({
			favorites: [{ sessionKey: 's1', path: 'p1', createdAt: 't' }],
			recentFolders: [{ id: 'a', name: 'a', handle: fakeDirHandle('a'), lastOpenedAt: 't' }]
		});

		const result = await clearRecentFolders(store);

		expect(result).toEqual({ ok: true, value: undefined });
		expect(await readRecentFolders(store)).toEqual({ ok: true, value: [] });
		expect(await readFavorites(store)).toEqual({ ok: true, value: [{ sessionKey: 's1', path: 'p1', createdAt: 't' }] });
	});

	it('저장 실패(quota) 시 upsertRecentFolder가 typed 실패를 반환하고 던지지 않는다', async () => {
		const store = fakeStore({ throwOn: { op: 'putRecentFolder', error: new DOMException('full', 'QuotaExceededError') } });

		const result = await upsertRecentFolder(store, {
			id: 'proj',
			name: 'proj',
			handle: fakeDirHandle('proj'),
			lastOpenedAt: '2026-07-23T00:00:00Z'
		});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe('quota-exceeded');
	});
});

describe('verifyRecentFolderPermission', () => {
	it('queryPermission이 granted면 ok를 반환한다', async () => {
		const handle = { queryPermission: async () => 'granted' as PermissionState };
		expect(await verifyRecentFolderPermission(handle)).toEqual({ ok: true, value: 'granted' });
	});

	it('queryPermission이 prompt/denied면 permission-expired 실패를 반환한다', async () => {
		const handle = { queryPermission: async () => 'prompt' as PermissionState };
		const result = await verifyRecentFolderPermission(handle);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe('permission-expired');
	});

	it('queryPermission이 없는 handle은 unknown 실패를 반환한다', async () => {
		const handle = {};
		const result = await verifyRecentFolderPermission(handle);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe('unknown');
	});

	it('queryPermission이 예외를 던지면 typed 실패로 변환한다', async () => {
		const handle = {
			queryPermission: async () => {
				throw new DOMException('denied', 'SecurityError');
			}
		};
		const result = await verifyRecentFolderPermission(handle);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe('permission-expired');
	});
});
