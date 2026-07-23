/**
 * Integration fixture — local repository → favorite 토글 → 최근 폴더 기록/삭제 흐름
 *
 * `localRepository.test.ts`가 개별 함수 단위 fixture를 검증하는 것과 달리, 이 파일은
 * `/claude-sessions` 개인화 흐름 전체(저장소 open → 즐겨찾기 추가/해제 → 최근 폴더
 * upsert/삭제)를 하나의 in-memory store 위에서 이어 실행해 통합 경로를 검증한다.
 * live/browser 호출은 하지 않는다(post-merge browser T4 소유) — `LocalRepositoryStore`
 * 인터페이스를 만족하는 in-memory fake만 사용한다.
 *
 * 핵심 검증: 흐름 전체를 거치는 동안 store에 transcript 본문(메시지 content, jsonl raw
 * 텍스트 등)이 어떤 형태로도 기록되지 않는다 — 저장되는 값은 항상 안정 세션 식별자
 * (sessionKey/path/sessionId)와 최근 폴더 메타(id/name/handle/lastOpenedAt/sessionCount)
 * 뿐이다.
 */
import { describe, it, expect } from 'vitest';
import {
	CURRENT_SCHEMA_VERSION,
	openLocalRepository,
	resetLocalRepository,
	addFavorite,
	readFavorites,
	removeFavorite,
	upsertRecentFolder,
	readRecentFolders,
	removeRecentFolder,
	clearRecentFolders,
	type FavoriteEntry,
	type LocalRepositoryStore,
	type RecentFolderEntry
} from './localRepository.js';

/** 허용된 필드만 기록됐는지 확인하기 위한 화이트리스트 — transcript 본문 관련 키가 섞이면 실패한다 */
const ALLOWED_FAVORITE_KEYS = new Set(['sessionKey', 'path', 'sessionId', 'createdAt']);
const ALLOWED_RECENT_FOLDER_KEYS = new Set(['id', 'name', 'handle', 'lastOpenedAt', 'sessionCount']);

/** localRepository.test.ts와 동일한 형태의 in-memory fake `LocalRepositoryStore` */
function fakeStore(
	options: {
		schemaVersion?: number;
		favorites?: FavoriteEntry[];
		recentFolders?: RecentFolderEntry[];
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
			favorites = [...favorites.filter((f) => f.sessionKey !== entry.sessionKey), entry];
		},
		async deleteFavorite(sessionKey) {
			favorites = favorites.filter((f) => f.sessionKey !== sessionKey);
		},
		async listRecentFolders() {
			return recentFolders;
		},
		async putRecentFolder(entry) {
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

/** transcript 본문이 저장되지 않았는지 — 각 항목의 키가 화이트리스트를 벗어나지 않는지 확인한다 */
function assertNoTranscriptBody(favorites: FavoriteEntry[], recentFolders: RecentFolderEntry[]): void {
	for (const entry of favorites) {
		for (const key of Object.keys(entry)) {
			expect(ALLOWED_FAVORITE_KEYS.has(key), `favorite entry에 허용되지 않은 키 "${key}"가 있다`).toBe(true);
		}
	}
	for (const entry of recentFolders) {
		for (const key of Object.keys(entry)) {
			expect(ALLOWED_RECENT_FOLDER_KEYS.has(key), `recent folder entry에 허용되지 않은 키 "${key}"가 있다`).toBe(true);
		}
	}
}

describe('localRepository 통합 흐름 — open → favorite 토글 → 최근 폴더 기록/삭제', () => {
	it('신규 저장소 open 이후 즐겨찾기 추가/해제, 최근 폴더 기록/삭제를 이어서 수행해도 transcript 본문이 저장되지 않는다', async () => {
		const store = fakeStore();

		// 1) local repository open — 신규 저장소이므로 schema version이 기록돼야 한다
		const opened = await openLocalRepository(store);
		expect(opened.ok).toBe(true);
		expect(await store.getSchemaVersion()).toBe(CURRENT_SCHEMA_VERSION);

		// 2) favorite 토글 — 세션 A를 즐겨찾기에 추가
		const added = await addFavorite(
			store,
			{ sessionId: 'sess-flow-1', path: 'projA/sess-flow-1.jsonl' },
			'2026-07-23T10:00:00Z'
		);
		expect(added.ok).toBe(true);

		const afterAdd = await readFavorites(store);
		expect(afterAdd.ok).toBe(true);
		if (afterAdd.ok) expect(afterAdd.value).toHaveLength(1);

		// 3) 최근 폴더 기록 — 폴더 A를 최근 폴더로 upsert
		const upserted = await upsertRecentFolder(store, {
			id: 'projA',
			name: 'projA',
			handle: fakeDirHandle('projA'),
			lastOpenedAt: '2026-07-23T10:05:00Z',
			sessionCount: 12
		});
		expect(upserted.ok).toBe(true);

		const afterUpsert = await readRecentFolders(store);
		expect(afterUpsert.ok).toBe(true);
		if (afterUpsert.ok) expect(afterUpsert.value.map((e) => e.id)).toEqual(['projA']);

		// 중간 지점 — 본문 비저장 검증
		{
			const favs = await readFavorites(store);
			const folders = await readRecentFolders(store);
			if (favs.ok && folders.ok) assertNoTranscriptBody(favs.value, folders.value);
		}

		// 4) favorite 토글 해제
		const removedFav = await removeFavorite(store, 'sess-flow-1');
		expect(removedFav.ok).toBe(true);

		const afterRemoveFav = await readFavorites(store);
		expect(afterRemoveFav.ok).toBe(true);
		if (afterRemoveFav.ok) expect(afterRemoveFav.value).toHaveLength(0);

		// 5) 최근 폴더 개별 삭제
		const removedFolder = await removeRecentFolder(store, 'projA');
		expect(removedFolder.ok).toBe(true);

		const afterRemoveFolder = await readRecentFolders(store);
		expect(afterRemoveFolder.ok).toBe(true);
		if (afterRemoveFolder.ok) expect(afterRemoveFolder.value).toHaveLength(0);

		// 6) 최종 상태 — 즐겨찾기/최근폴더 모두 비어있고, 그 과정에서 transcript 본문 관련
		// 필드가 한 번도 기록되지 않았음을 재확인한다(최종 상태 기준 재확인)
		const finalFavs = await readFavorites(store);
		const finalFolders = await readRecentFolders(store);
		expect(finalFavs.ok).toBe(true);
		expect(finalFolders.ok).toBe(true);
		if (finalFavs.ok && finalFolders.ok) {
			expect(finalFavs.value).toEqual([]);
			expect(finalFolders.value).toEqual([]);
			assertNoTranscriptBody(finalFavs.value, finalFolders.value);
		}
	});

	it('여러 세션 즐겨찾기 + 여러 최근 폴더를 섞어 기록/전체 삭제해도 즐겨찾기는 유지되고 본문은 저장되지 않는다', async () => {
		const store = fakeStore();
		await openLocalRepository(store);

		await addFavorite(store, { sessionId: 'sess-A', path: 'projA/sess-A.jsonl' }, '2026-07-23T09:00:00Z');
		await addFavorite(store, { path: 'projB/sess-B.jsonl' }, '2026-07-23T09:01:00Z');

		await upsertRecentFolder(store, {
			id: 'projA',
			name: 'projA',
			handle: fakeDirHandle('projA'),
			lastOpenedAt: '2026-07-23T09:02:00Z'
		});
		await upsertRecentFolder(store, {
			id: 'projB',
			name: 'projB',
			handle: fakeDirHandle('projB'),
			lastOpenedAt: '2026-07-23T09:03:00Z'
		});

		const midFavs = await readFavorites(store);
		const midFolders = await readRecentFolders(store);
		expect(midFavs.ok && midFavs.value.length).toBe(2);
		expect(midFolders.ok && midFolders.value.length).toBe(2);
		if (midFavs.ok && midFolders.ok) assertNoTranscriptBody(midFavs.value, midFolders.value);

		// 최근 폴더 전체 삭제 — 즐겨찾기는 유지돼야 한다
		const cleared = await clearRecentFolders(store);
		expect(cleared.ok).toBe(true);

		const afterClearFolders = await readRecentFolders(store);
		const afterClearFavs = await readFavorites(store);
		expect(afterClearFolders.ok).toBe(true);
		expect(afterClearFavs.ok).toBe(true);
		if (afterClearFolders.ok) expect(afterClearFolders.value).toEqual([]);
		if (afterClearFavs.ok) expect(afterClearFavs.value).toHaveLength(2);
		if (afterClearFavs.ok && afterClearFolders.ok) assertNoTranscriptBody(afterClearFavs.value, afterClearFolders.value);
	});

	it('알 수 없는 schema version에서 초기화(reset) 이후 흐름을 이어가도 본문이 저장되지 않는다', async () => {
		const store = fakeStore({
			schemaVersion: 999,
			favorites: [{ sessionKey: 'stale-1', path: 'stale/1.jsonl', createdAt: '2026-01-01T00:00:00Z' }],
			recentFolders: [{ id: 'stale-folder', name: 'stale-folder', handle: fakeDirHandle('stale-folder'), lastOpenedAt: '2026-01-01T00:00:00Z' }]
		});

		// open은 알 수 없는 버전이라 실패해야 한다(데이터 비변경)
		const opened = await openLocalRepository(store);
		expect(opened.ok).toBe(false);
		if (!opened.ok) expect(opened.error.kind).toBe('unknown-schema-version');

		// 초기화 action 수행
		const reset = await resetLocalRepository(store);
		expect(reset.ok).toBe(true);
		expect(await store.getSchemaVersion()).toBe(CURRENT_SCHEMA_VERSION);
		expect(await store.listFavorites()).toEqual([]);
		expect(await store.listRecentFolders()).toEqual([]);

		// 초기화 이후 재개 — 새 즐겨찾기/최근 폴더 흐름이 정상 동작하고 본문은 여전히 미저장
		await addFavorite(store, { sessionId: 'sess-fresh', path: 'fresh/sess-fresh.jsonl' }, '2026-07-24T00:00:00Z');
		await upsertRecentFolder(store, {
			id: 'fresh-folder',
			name: 'fresh-folder',
			handle: fakeDirHandle('fresh-folder'),
			lastOpenedAt: '2026-07-24T00:01:00Z'
		});

		const favs = await readFavorites(store);
		const folders = await readRecentFolders(store);
		expect(favs.ok && favs.value.length).toBe(1);
		expect(folders.ok && folders.value.length).toBe(1);
		if (favs.ok && folders.ok) assertNoTranscriptBody(favs.value, folders.value);
	});
});
