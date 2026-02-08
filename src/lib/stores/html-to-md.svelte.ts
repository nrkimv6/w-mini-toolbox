import { writable, get } from 'svelte/store';
import type { SourceRule } from '$lib/tools/html-to-md/converter/converter.js';
import type { UserOptions } from '$lib/tools/html-to-md/types/options.js';
import { loadSettings, saveSettings, saveInputContent, loadInputContent, clearAllSettings, type StorageSettings } from '$lib/tools/html-to-md/utils/storage.js';

// 브라우저 환경에서만 localStorage 로드
const isBrowser = typeof window !== 'undefined';
const initialSettings = isBrowser ? loadSettings() : null;

// 입력 HTML - localStorage에서 복원
function createInputHtmlStore() {
	const initialValue = isBrowser && initialSettings?.userOptions.autoSaveInput
		? (initialSettings.inputContent || '')
		: '';

	const { subscribe, set, update } = writable(initialValue);

	return {
		subscribe,
		set: (value: string) => {
			set(value);
			// autoSaveInput이 활성화되어 있으면 자동 저장
			if (isBrowser) {
				const settings = loadSettings();
				if (settings.userOptions.autoSaveInput) {
					saveInputContent(value);
				}
			}
		},
		update
	};
}

export const inputHtml = createInputHtmlStore();

// 출력 Markdown
export const outputMarkdown = writable('');

// 변환 중 상태
export const isConverting = writable(false);

// 출력 패널 미리보기 모드
export const isPreviewMode = writable(false);

// 경고 메시지 상태
export const warningMessage = writable('');

// 선택된 클립보드 포맷
export const selectedFormat = writable('HTML');

// 현재 입력 규칙 - localStorage에서 복원
function createCurrentInputRuleStore() {
	const initialValue = initialSettings?.sourceRule || 'default';
	const { subscribe, set, update } = writable<SourceRule>(initialValue);

	return {
		subscribe,
		set: (value: SourceRule) => {
			set(value);
			// localStorage에 저장
			if (isBrowser) {
				const settings = loadSettings();
				saveSettings({
					...settings,
					sourceRule: value
				});
			}
		},
		update
	};
}

export const currentInputRule = createCurrentInputRuleStore();

// 사용자 옵션 - localStorage에서 복원
function createUserOptionsStore() {
	const initialValue: UserOptions = initialSettings?.userOptions || {
		autoClearAfterCopy: false,
		autoClearAfterDownload: true,
		autoSaveInput: false
	};

	const { subscribe, set, update } = writable<UserOptions>(initialValue);

	return {
		subscribe,
		set: (value: UserOptions) => {
			set(value);
			// localStorage에 저장
			if (isBrowser) {
				const settings = loadSettings();
				saveSettings({
					...settings,
					userOptions: value
				});
			}
		},
		update: (fn: (value: UserOptions) => UserOptions) => {
			update((current) => {
				const newValue = fn(current);
				// localStorage에 저장
				if (isBrowser) {
					const settings = loadSettings();
					saveSettings({
						...settings,
						userOptions: newValue
					});
				}
				return newValue;
			});
		}
	};
}

export const userOptions = createUserOptionsStore();

// Cleanup 함수 - 로그아웃 시 모든 설정 초기화
export function cleanup() {
	if (!isBrowser) return;

	// 스토어 초기화
	inputHtml.set('');
	outputMarkdown.set('');
	isConverting.set(false);
	isPreviewMode.set(false);
	warningMessage.set('');
	selectedFormat.set('HTML');
	currentInputRule.set('default');
	userOptions.set({
		autoClearAfterCopy: false,
		autoClearAfterDownload: true,
		autoSaveInput: false
	});

	// localStorage 클리어
	clearAllSettings();
}
