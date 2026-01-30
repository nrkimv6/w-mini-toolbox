import type { SourceRule } from '$lib/tools/html-to-md/converter/converter.js';

// 저장할 설정 데이터 타입 정의
export interface StorageSettings {
	sourceRule: SourceRule;
	userOptions: {
		autoClearAfterCopy: boolean;
		autoClearAfterDownload: boolean;
		autoSaveInput: boolean;
	};
	language: string;
	uiState: {
		optionsPanelExpanded: boolean;
	};
	inputContent: string;
	version: string;
}

// 기본 설정값
const DEFAULT_SETTINGS: StorageSettings = {
	sourceRule: 'default' as SourceRule,
	userOptions: {
		autoClearAfterCopy: false,
		autoClearAfterDownload: true,
		autoSaveInput: false
	},
	language: 'ko',
	uiState: {
		optionsPanelExpanded: false
	},
	inputContent: '',
	version: '1.0.0'
};

// 로컬스토리지 키
const STORAGE_KEY = 'htmlToMarkdown_settings';

// 디바운스 타이머
let saveTimer: NodeJS.Timeout | null = null;

/**
 * localStorage에서 설정 읽기
 */
export function loadSettings(): StorageSettings {
	if (typeof window === 'undefined') {
		return DEFAULT_SETTINGS;
	}

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) {
			return DEFAULT_SETTINGS;
		}

		const parsed = JSON.parse(stored) as StorageSettings;
		
		// 설정 유효성 검사
		if (!isValidSettings(parsed)) {
			console.warn('Invalid settings found, using defaults');
			return DEFAULT_SETTINGS;
		}

		// 버전 확인 및 마이그레이션 (필요시)
		if (parsed.version !== DEFAULT_SETTINGS.version) {
			console.log('Settings version mismatch, migrating...');
			return migrateSettings(parsed);
		}

		return parsed;
	} catch (error) {
		console.error('Failed to load settings:', error);
		return DEFAULT_SETTINGS;
	}
}

/**
 * localStorage에 설정 저장 (디바운스 적용)
 */
export function saveSettings(settings: StorageSettings): void {
	if (typeof window === 'undefined') {
		return;
	}

	// 이전 타이머 취소
	if (saveTimer) {
		clearTimeout(saveTimer);
	}

	// 300ms 후 저장 실행
	saveTimer = setTimeout(() => {
		try {
			const serialized = JSON.stringify(settings);
			localStorage.setItem(STORAGE_KEY, serialized);
			console.log('💾 Settings auto-saved');
		} catch (error) {
			console.error('Failed to save settings:', error);
			// Quota 초과 등의 경우 오래된 데이터 정리 시도
			try {
				clearOldData();
				localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
			} catch (retryError) {
				console.error('Failed to save settings after cleanup:', retryError);
			}
		}
	}, 300);
}

/**
 * 모든 저장된 설정 삭제
 */
export function clearAllSettings(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}

	try {
		localStorage.removeItem(STORAGE_KEY);
		console.log('🗑️ All settings cleared');
		return true;
	} catch (error) {
		console.error('Failed to clear settings:', error);
		return false;
	}
}

/**
 * 설정 유효성 검사
 */
function isValidSettings(settings: unknown): settings is StorageSettings {
	if (!settings || typeof settings !== 'object') {
		return false;
	}

	const s = settings as Record<string, unknown>;

	return (
		typeof s.sourceRule === 'string' &&
		typeof s.userOptions === 'object' &&
		s.userOptions !== null &&
		typeof s.language === 'string' &&
		typeof s.uiState === 'object' &&
		s.uiState !== null &&
		typeof s.inputContent === 'string' &&
		typeof s.version === 'string'
	);
}

/**
 * 설정 마이그레이션
 */
function migrateSettings(oldSettings: StorageSettings): StorageSettings {
	// 현재는 기본값으로 대체, 향후 필요시 마이그레이션 로직 추가
	return {
		...DEFAULT_SETTINGS,
		// 일부 설정은 유지
		language: oldSettings.language || DEFAULT_SETTINGS.language,
		userOptions: {
			...DEFAULT_SETTINGS.userOptions,
			...oldSettings.userOptions
		}
	};
}

/**
 * 오래된 데이터 정리 (quota 초과 시)
 */
function clearOldData(): void {
	try {
		// 다른 앱의 오래된 데이터 정리를 위한 패턴들
		const keysToCheck = Object.keys(localStorage);
		const oldKeys = keysToCheck.filter(key => 
			key.includes('_old_') || 
			key.includes('temp_') ||
			key.includes('cache_')
		);

		oldKeys.forEach(key => {
			try {
				localStorage.removeItem(key);
			} catch {
				// 개별 삭제 실패는 무시
			}
		});
	} catch {
		// 전체 정리 실패는 무시
	}
}

/**
 * 입력 내용 저장 (디바운스 적용)
 */
export function saveInputContent(content: string): void {
	if (typeof window === 'undefined') {
		return;
	}

	try {
		const currentSettings = loadSettings();
		if (!currentSettings.userOptions.autoSaveInput) {
			return; // 자동 저장이 비활성화된 경우 저장하지 않음
		}

		const updatedSettings = {
			...currentSettings,
			inputContent: content
		};

		saveSettings(updatedSettings);
	} catch (error) {
		console.error('Failed to save input content:', error);
	}
}

/**
 * 저장된 입력 내용 로드
 */
export function loadInputContent(): string {
	if (typeof window === 'undefined') {
		return '';
	}

	try {
		const settings = loadSettings();
		if (!settings.userOptions.autoSaveInput) {
			return ''; // 자동 저장이 비활성화된 경우 빈 문자열 반환
		}
		return settings.inputContent || '';
	} catch (error) {
		console.error('Failed to load input content:', error);
		return '';
	}
}

/**
 * 입력 내용 삭제
 */
export function clearInputContent(): void {
	if (typeof window === 'undefined') {
		return;
	}

	try {
		const currentSettings = loadSettings();
		const updatedSettings = {
			...currentSettings,
			inputContent: ''
		};

		saveSettings(updatedSettings);
	} catch (error) {
		console.error('Failed to clear input content:', error);
	}
}

/**
 * 저장소 상태 확인
 */
export function getStorageStatus(): {
	isAvailable: boolean;
	hasSettings: boolean;
	size: number;
} {
	if (typeof window === 'undefined') {
		return {
			isAvailable: false,
			hasSettings: false,
			size: 0
		};
	}

	try {
		const hasSettings = localStorage.getItem(STORAGE_KEY) !== null;
		const size = localStorage.getItem(STORAGE_KEY)?.length || 0;

		return {
			isAvailable: true,
			hasSettings,
			size
		};
	} catch {
		return {
			isAvailable: false,
			hasSettings: false,
			size: 0
		};
	}
}