import { writable } from 'svelte/store';
import type { SourceRule } from '$lib/tools/html-to-md/converter/converter.js';
import type { UserOptions } from '$lib/tools/html-to-md/types/options.js';

// 입력 HTML
export const inputHtml = writable('');

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

// 현재 입력 규칙
export const currentInputRule = writable<SourceRule>('default');

// 사용자 옵션
export const userOptions = writable<UserOptions>({
	skipEmptyLines: true,
	preserveCodeBlocks: true,
	convertLinks: true
});
