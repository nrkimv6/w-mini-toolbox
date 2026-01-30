import type { SourceRule } from '$lib/tools/html-to-md/converter/converter.js';
import type { UserOptions } from '$lib/tools/html-to-md/types/options.js';

// 입력 HTML
export let inputHtml = $state('');

// 출력 Markdown
export let outputMarkdown = $state('');

// 변환 중 상태
export let isConverting = $state(false);

// 출력 패널 미리보기 모드
export let isPreviewMode = $state(false);

// 경고 메시지 상태
export let warningMessage = $state('');

// 선택된 클립보드 포맷
export let selectedFormat = $state('HTML');

// 현재 입력 규칙
export let currentInputRule = $state<SourceRule>('default');

// 사용자 옵션
export let userOptions = $state<UserOptions>({
	skipEmptyLines: true,
	preserveCodeBlocks: true,
	convertLinks: true
});
