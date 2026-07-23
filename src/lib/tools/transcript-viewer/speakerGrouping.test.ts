/**
 * Unit Tests for shouldShowHeader (speaker merge boundary)
 * + shouldShowDateDivider (date-change divider boundary)
 */
import { describe, it, expect } from 'vitest';
import { shouldShowHeader, shouldShowDateDivider, type SpeakerGroupingFields, type DateDividerFields } from './speakerGrouping.js';

function fields(overrides: Partial<SpeakerGroupingFields> = {}): SpeakerGroupingFields {
	return {
		role: 'assistant',
		isSidechain: false,
		model: 'claude-sonnet-5',
		...overrides
	};
}

describe('shouldShowHeader', () => {
	it('prev가 없으면(첫 메시지) true를 반환한다', () => {
		expect(shouldShowHeader(undefined, fields())).toBe(true);
	});

	it('연속 동일 role(assistant) 2건째부터 false(병합)를 반환한다', () => {
		const prev = fields({ role: 'assistant' });
		const cur = fields({ role: 'assistant' });
		expect(shouldShowHeader(prev, cur)).toBe(false);
	});

	it('role 전환 시 true를 반환한다', () => {
		const prev = fields({ role: 'user' });
		const cur = fields({ role: 'assistant' });
		expect(shouldShowHeader(prev, cur)).toBe(true);
	});

	it('isSidechain 전환 시 true를 반환한다', () => {
		const prev = fields({ isSidechain: false });
		const cur = fields({ isSidechain: true });
		expect(shouldShowHeader(prev, cur)).toBe(true);
	});

	it('model 전환 시 true를 반환한다', () => {
		const prev = fields({ model: 'claude-sonnet-5' });
		const cur = fields({ model: 'claude-opus-5' });
		expect(shouldShowHeader(prev, cur)).toBe(true);
	});
});

describe('shouldShowDateDivider', () => {
	/**
	 * 로컬 시각으로 Date를 구성한 뒤 ISO 문자열로 직렬화한다.
	 * shouldShowDateDivider가 내부적으로 `new Date(ts)` → 로컬 연/월/일을
	 * 추출하므로, 이 헬퍼로 만든 두 타임스탬프를 비교하면 테스트 실행
	 * 환경의 실제 타임존과 무관하게 "표시 HH:MM과 동일한 로컬 기준"을
	 * 재현할 수 있다.
	 */
	function localTs(year: number, month: number, day: number, hour = 0, minute = 0): string {
		return new Date(year, month - 1, day, hour, minute).toISOString();
	}

	function tsFields(ts: string | undefined): DateDividerFields {
		return { timestamp: ts };
	}

	it('prev가 없으면(첫 메시지) true를 반환한다', () => {
		expect(shouldShowDateDivider(undefined, tsFields(localTs(2026, 7, 23, 10, 0)))).toBe(true);
	});

	it('같은 날짜의 인접 메시지는 false를 반환한다', () => {
		const prev = tsFields(localTs(2026, 7, 23, 9, 0));
		const cur = tsFields(localTs(2026, 7, 23, 23, 59));
		expect(shouldShowDateDivider(prev, cur)).toBe(false);
	});

	it('날짜 경계(자정 전후)를 지나면 true를 반환한다', () => {
		const prev = tsFields(localTs(2026, 7, 22, 23, 59));
		const cur = tsFields(localTs(2026, 7, 23, 0, 1));
		expect(shouldShowDateDivider(prev, cur)).toBe(true);
	});

	it('cur.timestamp가 없으면 false(직전 날짜 유지)를 반환한다', () => {
		const prev = tsFields(localTs(2026, 7, 23, 9, 0));
		const cur = tsFields(undefined);
		expect(shouldShowDateDivider(prev, cur)).toBe(false);
	});

	it('cur.timestamp가 파싱 불가(NaN)면 false(직전 날짜 유지)를 반환한다', () => {
		const prev = tsFields(localTs(2026, 7, 23, 9, 0));
		const cur = tsFields('not-a-valid-date');
		expect(shouldShowDateDivider(prev, cur)).toBe(false);
	});

	it('prev.timestamp가 없으면 소급 탐색하지 않고 false를 반환한다', () => {
		const prev = tsFields(undefined);
		const cur = tsFields(localTs(2026, 7, 23, 10, 0));
		expect(shouldShowDateDivider(prev, cur)).toBe(false);
	});

	it('prev.timestamp가 파싱 불가(NaN)면 소급 탐색하지 않고 false를 반환한다', () => {
		const prev = tsFields('invalid');
		const cur = tsFields(localTs(2026, 7, 23, 10, 0));
		expect(shouldShowDateDivider(prev, cur)).toBe(false);
	});

	it('연도 경계(12/31 23:59 → 1/1 00:01)도 날짜 변경으로 판정한다', () => {
		const prev = tsFields(localTs(2026, 12, 31, 23, 59));
		const cur = tsFields(localTs(2027, 1, 1, 0, 1));
		expect(shouldShowDateDivider(prev, cur)).toBe(true);
	});
});
