/**
 * Transcript Viewer — 세션 비교·프로젝트 집계 순수 함수
 *
 * 여러 세션의 지표를 나란히 비교(min/max/delta)하고, 프로젝트(`cwd`) 단위로
 * 집계(합계·평균·최근 활동)한다. `SessionSummary`(경량 목록 요약)만으로는 토큰/메시지
 * 지표를 낼 수 없으므로, 전체 파싱된 `TranscriptMeta`(parser.ts의 `parseTranscript`
 * 산출물)를 함께 받는 `SessionAnalyticsInput`을 입력 단위로 사용한다. `meta`가 없는
 * 세션(아직 열어보지 않은 세션)은 누락값으로 처리하고 예외를 던지지 않는다.
 *
 * 브라우저 API 의존이 전혀 없는 순수 함수만 포함한다(카탈로그 쿼리와 동일한
 * 테스트 가능 경계 — sessionCatalog.ts 참조).
 */
import type { SessionSummary, TranscriptMeta } from './types.js';

/** sessionAnalytics 입력 단위 — 목록 요약 + (있으면) 전체 파싱 메타 */
export interface SessionAnalyticsInput extends SessionSummary {
	/** parseTranscript(text).meta — 세션을 아직 열어보지 않았으면 undefined(누락값으로 처리) */
	meta?: TranscriptMeta;
}

/** compareSessionMetrics가 지원하는 비교 지표 */
export type AnalyticsMetricKey =
	| 'totalMessages'
	| 'totalInputTokens'
	| 'totalOutputTokens'
	| 'totalCacheTokens'
	| 'durationMs'
	| 'subagentCount';

/** 기본 비교 지표 순서 */
export const DEFAULT_METRIC_KEYS: AnalyticsMetricKey[] = [
	'totalMessages',
	'totalInputTokens',
	'totalOutputTokens',
	'totalCacheTokens',
	'durationMs',
	'subagentCount'
];

/** 세션 1건에 대한 지표 값 — 값이 없으면(누락) `value: null` */
export interface SessionMetricValue {
	path: string;
	sessionId?: string;
	aiTitle?: string;
	value: number | null;
}

/** 지표 하나에 대한 세션 간 비교 결과 */
export interface MetricComparison {
	metric: AnalyticsMetricKey;
	values: SessionMetricValue[];
	/** 유효(non-null) 값 중 최솟값을 가진 세션. 유효 값이 하나도 없으면 null */
	min: { path: string; value: number } | null;
	/** 유효(non-null) 값 중 최댓값을 가진 세션. 유효 값이 하나도 없으면 null */
	max: { path: string; value: number } | null;
	/** max.value - min.value. 유효 값이 2개 미만이면 null(비교 불가) */
	delta: number | null;
}

/** durationMs 계산 시 first/last 우선순위 — SessionSummary가 있으면 그걸, 없으면 meta로 fallback */
function resolveTimestamp(input: SessionAnalyticsInput, kind: 'first' | 'last'): string | undefined {
	if (kind === 'first') return input.firstTimestamp ?? input.meta?.firstTimestamp;
	return input.lastTimestamp ?? input.meta?.lastTimestamp;
}

/** 단일 지표 값을 추출한다. 필요한 원천 데이터가 없으면 null(누락값)을 반환한다 */
export function extractMetricValue(input: SessionAnalyticsInput, metric: AnalyticsMetricKey): number | null {
	switch (metric) {
		case 'totalMessages':
			return typeof input.meta?.totalMessages === 'number' ? input.meta.totalMessages : null;
		case 'totalInputTokens':
			return typeof input.meta?.totalInputTokens === 'number' ? input.meta.totalInputTokens : null;
		case 'totalOutputTokens':
			return typeof input.meta?.totalOutputTokens === 'number' ? input.meta.totalOutputTokens : null;
		case 'totalCacheTokens':
			if (!input.meta) return null;
			return input.meta.totalCacheCreationTokens + input.meta.totalCacheReadTokens;
		case 'durationMs': {
			const first = resolveTimestamp(input, 'first');
			const last = resolveTimestamp(input, 'last');
			if (!first || !last) return null;
			const firstMs = Date.parse(first);
			const lastMs = Date.parse(last);
			if (!Number.isFinite(firstMs) || !Number.isFinite(lastMs)) return null;
			return lastMs - firstMs;
		}
		case 'subagentCount':
			return typeof input.subagentCount === 'number' ? input.subagentCount : null;
		default:
			return null;
	}
}

/**
 * 여러 세션의 지표를 나란히 비교한다. 각 지표별로 세션별 값(누락은 null)과
 * min/max/delta를 계산한다. 값이 0인 세션도 유효 값으로 취급한다(누락값 null과 구분).
 */
export function compareSessionMetrics(
	sessions: SessionAnalyticsInput[],
	metrics: AnalyticsMetricKey[] = DEFAULT_METRIC_KEYS
): MetricComparison[] {
	return metrics.map((metric) => {
		const values: SessionMetricValue[] = sessions.map((session) => ({
			path: session.path,
			sessionId: session.sessionId,
			aiTitle: session.aiTitle,
			value: extractMetricValue(session, metric)
		}));

		let min: { path: string; value: number } | null = null;
		let max: { path: string; value: number } | null = null;
		let validCount = 0;

		for (const entry of values) {
			if (entry.value === null) continue;
			validCount++;
			if (min === null || entry.value < min.value) min = { path: entry.path, value: entry.value };
			if (max === null || entry.value > max.value) max = { path: entry.path, value: entry.value };
		}

		return {
			metric,
			values,
			min,
			max,
			delta: validCount >= 2 && min && max ? max.value - min.value : null
		};
	});
}

/** aggregateSessionsByProject의 프로젝트별 집계 결과 */
export interface ProjectAggregate {
	/** 프로젝트 식별자 — `cwd`. 없는 세션은 `'(unknown)'` 그룹으로 묶는다 */
	project: string;
	/** 그룹에 속한 세션 개수(meta 유무 무관 — 전부 카운트) */
	sessionCount: number;
	/** meta가 있는 세션에서만 합산한 총 메시지 수 */
	totalMessages: number;
	/** meta가 있는 세션에서만 합산한 총 토큰(input+output+cache) 수 */
	totalTokens: number;
	/** totalMessages / meta 보유 세션 수. meta 보유 세션이 없으면 0 */
	avgMessages: number;
	/** totalTokens / meta 보유 세션 수. meta 보유 세션이 없으면 0 */
	avgTokens: number;
	/** 그룹 내 세션들의 lastTimestamp(없으면 firstTimestamp) 중 가장 최근 값 */
	lastActivity?: string;
}

/** aggregateSessionsByProject 필터 옵션 */
export interface AggregateOptions {
	/** ISO 문자열 이상 — lastActivity(없으면 firstTimestamp) 기준 문자열 비교 */
	dateFrom?: string;
	/** ISO 문자열 이하 — lastActivity(없으면 firstTimestamp) 기준 문자열 비교 */
	dateTo?: string;
	/** meta.models와 하나 이상 교집합이 있는 세션만 포함. meta가 없는 세션은 모델 조건이 있으면 제외 */
	models?: string[];
}

function sessionActivityTimestamp(session: SessionAnalyticsInput): string | undefined {
	return session.lastTimestamp ?? session.meta?.lastTimestamp ?? session.firstTimestamp ?? session.meta?.firstTimestamp;
}

function passesDateFilter(session: SessionAnalyticsInput, options: AggregateOptions): boolean {
	if (!options.dateFrom && !options.dateTo) return true;
	const activity = sessionActivityTimestamp(session);
	if (!activity) return false;
	if (options.dateFrom && activity < options.dateFrom) return false;
	if (options.dateTo && activity > options.dateTo) return false;
	return true;
}

function passesModelFilter(session: SessionAnalyticsInput, options: AggregateOptions): boolean {
	if (!options.models || options.models.length === 0) return true;
	const models = session.meta?.models;
	if (!models || models.length === 0) return false;
	return options.models.some((wanted) => models.includes(wanted));
}

/**
 * 세션을 `cwd`(프로젝트) 기준으로 그룹핑해 세션 수·합계·평균·최근 활동을 집계한다.
 * `dateFrom`/`dateTo`/`models` 조건을 만족하지 않는 세션은 집계에서 제외된다.
 * 그룹 내 `meta`가 없는 세션은 `sessionCount`에는 포함되지만 합계/평균 계산에서는 제외된다.
 */
export function aggregateSessionsByProject(
	sessions: SessionAnalyticsInput[],
	options: AggregateOptions = {}
): ProjectAggregate[] {
	const filtered = sessions.filter((session) => passesDateFilter(session, options) && passesModelFilter(session, options));

	const groups = new Map<
		string,
		{ sessionCount: number; totalMessages: number; totalTokens: number; metaCount: number; lastActivity?: string }
	>();

	for (const session of filtered) {
		const project = session.cwd ?? '(unknown)';
		const group = groups.get(project) ?? {
			sessionCount: 0,
			totalMessages: 0,
			totalTokens: 0,
			metaCount: 0,
			lastActivity: undefined
		};

		group.sessionCount++;
		if (session.meta) {
			group.metaCount++;
			group.totalMessages += session.meta.totalMessages;
			group.totalTokens +=
				session.meta.totalInputTokens +
				session.meta.totalOutputTokens +
				session.meta.totalCacheCreationTokens +
				session.meta.totalCacheReadTokens;
		}

		const activity = sessionActivityTimestamp(session);
		if (activity && (!group.lastActivity || activity > group.lastActivity)) group.lastActivity = activity;

		groups.set(project, group);
	}

	return Array.from(groups.entries()).map(([project, group]) => ({
		project,
		sessionCount: group.sessionCount,
		totalMessages: group.totalMessages,
		totalTokens: group.totalTokens,
		avgMessages: group.metaCount > 0 ? group.totalMessages / group.metaCount : 0,
		avgTokens: group.metaCount > 0 ? group.totalTokens / group.metaCount : 0,
		lastActivity: group.lastActivity
	}));
}
