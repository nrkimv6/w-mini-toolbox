<script context="module" lang="ts">
	// 입력 타입별로 사용 가능한 출력 규칙 정의
	export type OutputRule = 'raw' | 'formatted' | 'clean' | 'structured' | 'minimal' | 'markdown_optimize' | 'gemini_format1' | 'gemini_format2' | 'gemini_format3' | 'gemini_format4' | 'claude_format1' | 'claude_format2' | 'claude_format3' | 'claude_format4';
</script>

<script lang="ts">
	import { currentInputRule, isPreviewMode, selectedFormat } from '$lib/stores/html-to-md.svelte.js';
	import { getAvailableRules, setSourceRule, setOutputRule, type SourceRule } from '$lib/tools/html-to-md/converter/converter.js';
	import { FileOutput, Eye, Code, Settings } from 'lucide-svelte';
	import { onMount } from 'svelte';

	interface OutputRuleOption {
		key: OutputRule;
		name: string;
		description: string;
		supportedHandleRules: string[]; // 지원하는 변환 규칙 목록
		condition?: (currentRule: string, format: string) => boolean;
	}

	const outputRuleOptions: OutputRuleOption[] = [
		{
			key: 'raw',
			name: '원본',
			description: '변환된 마크다운을 그대로 출력',
			supportedHandleRules: ['default', 'gemini', 'notion', 'claude', 'chatgpt']
		},
		// {
		// 	key: 'gemini_format1',
		// 	name: 'Gemini 대화형',
		// 	description: '## 사용자/AI 헤딩으로 대화 구조화',
		// 	supportedInputTypes: ['gemini', 'claude_desktop_drag', 'claude_drag_html', 'claude_dev_html', 'chatgpt_desktop_drag', 'chatgpt_drag_html', 'chatgpt_dev_html'],
		// 	condition: (currentRule: string, format: string) => {
		// 		return (currentRule.includes('gemini') || currentRule.includes('claude') || currentRule.includes('chatgpt')) && format === 'HTML';
		// 	}
		// },
		// {
		// 	key: 'gemini_format2',
		// 	name: 'Gemini QA형',
		// 	description: '## 질문/답변 형태로 구조화',
		// 	supportedInputTypes: ['gemini', 'claude_desktop_drag', 'claude_drag_html', 'claude_dev_html', 'chatgpt_desktop_drag', 'chatgpt_drag_html', 'chatgpt_dev_html'],
		// 	condition: (currentRule: string, format: string) => {
		// 		return (currentRule.includes('gemini') || currentRule.includes('claude') || currentRule.includes('chatgpt')) && format === 'HTML';
		// 	}
		// },
		{
			key: 'minimal',
			name: '서식제거',
			description: '핵심 텍스트만 남기고 모든 서식 제거',
			supportedHandleRules: ['default', 'gemini', 'notion', 'claude', 'chatgpt']
		},
		{
			key: 'markdown_optimize',
			name: '✨ 마크다운 최적화',
			description: '빈 링크 제거, 서식 정리 등 마크다운 품질 개선',
			supportedHandleRules: ['default', 'gemini', 'notion', 'claude', 'chatgpt']
		},
		{
			key: 'gemini_format1',
			name: '🤖 Gemini 대화형',
			description: '## 사용자/AI 헤딩으로 대화 구조화',
			supportedHandleRules: ['gemini'],
			condition: (currentRule: string, format: string) => {
				return currentRule === 'gemini' && format === 'HTML';
			}
		},
		{
			key: 'gemini_format2',
			name: '🤖 Gemini QA형',
			description: '## 질문/답변 형태로 구조화',
			supportedHandleRules: ['gemini'],
			condition: (currentRule: string, format: string) => {
				return currentRule === 'gemini' && format === 'HTML';
			}
		},
		{
			key: 'gemini_format3',
			name: '🤖 Gemini 인용형',
			description: '질문과 답변을 인용구로 구조화',
			supportedHandleRules: ['gemini'],
			condition: (currentRule: string, format: string) => {
				return currentRule === 'gemini' && format === 'HTML';
			}
		},
		{
			key: 'gemini_format4',
			name: '🤖 Gemini 코드형',
			description: '사용자/Gemini를 코드 블록으로 구조화',
			supportedHandleRules: ['gemini'],
			condition: (currentRule: string, format: string) => {
				return currentRule === 'gemini' && format === 'HTML';
			}
		},
		{
			key: 'claude_format1',
			name: '💬 Claude 대화형',
			description: '## 사용자/Claude 헤딩으로 대화 구조화',
			supportedHandleRules: ['claude'],
			condition: (currentRule: string, format: string) => {
				return currentRule === 'claude' && format === 'HTML';
			}
		},
		{
			key: 'claude_format2',
			name: '💬 Claude QA형',
			description: '## 질문/답변 형태로 구조화',
			supportedHandleRules: ['claude'],
			condition: (currentRule: string, format: string) => {
				return currentRule === 'claude' && format === 'HTML';
			}
		},
		{
			key: 'claude_format3',
			name: '💬 Claude 인용형',
			description: '질문과 답변을 인용구로 구조화',
			supportedHandleRules: ['claude'],
			condition: (currentRule: string, format: string) => {
				return currentRule === 'claude' && format === 'HTML';
			}
		},
		{
			key: 'claude_format4',
			name: '💬 Claude 코드형',
			description: '사용자/Claude를 코드 블록으로 구조화',
			supportedHandleRules: ['claude'],
			condition: (currentRule: string, format: string) => {
				return currentRule === 'claude' && format === 'HTML';
			}
		}
	];

	export let selectedOutputRule: OutputRule = 'raw';
	
	// 변환규칙 관련
	let availableRules: ReturnType<typeof getAvailableRules> = [];
	
	function handleInputRuleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const newRule = target.value as SourceRule;
		currentInputRule.set(newRule);
		setSourceRule(newRule);
	}

	// 현재 선택된 변환 규칙에 따라 사용 가능한 출력 규칙 필터링
	$: availableOutputRules = outputRuleOptions.filter(rule => {
		const isSupported = rule.supportedHandleRules.includes($currentInputRule);
		if (!rule.condition) return isSupported;
		return isSupported && rule.condition($currentInputRule, $selectedFormat);
	});

	// 현재 변환 규칙이 바뀌면 첫 번째 사용 가능한 출력 규칙으로 자동 변경
	$: if (availableOutputRules.length > 0 && !availableOutputRules.some(rule => rule.key === selectedOutputRule)) {
		selectedOutputRule = availableOutputRules[0].key;
		// converter.ts에 출력 규칙 전달
		setOutputRule(selectedOutputRule);
	}

	function handleRuleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedOutputRule = target.value as OutputRule;
		// converter.ts에 출력 규칙 전달
		setOutputRule(selectedOutputRule);
	}

	// 미리보기 모드 토글
	function togglePreviewMode() {
		isPreviewMode.update(mode => !mode);
	}
	
	onMount(() => {
		// Initialize available rules
		availableRules = getAvailableRules();
		// 초기 출력 규칙 설정
		setOutputRule(selectedOutputRule);
	});
</script>

<div class="output-rule-selector">
	<div class="selector-container">
		<!-- 인식규칙 선택 -->
		<div class="selector-column">
			<div class="selector-header">
				<label for="input-rule-select" class="selector-label">
					<Settings size={16} />
					입력 형식
				</label>
			</div>
			<select
				id="input-rule-select"
				class="rule-select"
				value={$currentInputRule}
				onchange={handleInputRuleChange}
			>
				{#each availableRules as rule}
					<option value={rule.key} title={rule.description}>
						{rule.name}
					</option>
				{/each}
			</select>
		</div>

		<!-- 출력규칙 선택 -->
		<div class="selector-column">
			<div class="selector-header">
				<label for="output-rule-select" class="selector-label">
					<FileOutput size={16} />
					출력 형식
				</label>
				<button
					class="preview-toggle"
					class:active={$isPreviewMode}
					onclick={togglePreviewMode}
					title={$isPreviewMode ? '코드 보기' : '미리보기'}
				>
					{#if $isPreviewMode}
						<Code size={14} />
					{:else}
						<Eye size={14} />
					{/if}
				</button>
			</div>
			<select
				id="output-rule-select"
				value={selectedOutputRule}
				onchange={handleRuleChange}
				class="rule-select"
			>
				{#each availableOutputRules as rule}
					<option value={rule.key} title={rule.description}>
						{rule.name}
						<!-- {rule.name} - {rule.description} -->
					</option>
				{/each}
			</select>
		</div>
	</div>
</div>

<style>
	.output-rule-selector {
		padding: 1rem 1.25rem;
		border-bottom: 1px solid hsl(280 60% 70% / 0.15);
		background: hsl(280 60% 70% / 0.04);
	}
	
	.selector-container {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}
	
	.selector-column {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.selector-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
		min-height: 28px;
	}

	.selector-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: hsl(280 60% 40%);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.preview-toggle {
		background: hsl(0 0% 100%);
		border: 1px solid hsl(280 60% 70% / 0.3);
		border-radius: 0.25rem;
		padding: 0.375rem;
		cursor: pointer;
		color: hsl(280 60% 50%);
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
	}

	.preview-toggle:hover {
		background: hsl(280 60% 70% / 0.1);
		border-color: hsl(280 60% 70%);
		color: hsl(280 60% 40%);
	}

	.preview-toggle.active {
		background: hsl(280 60% 70% / 0.15);
		border-color: hsl(280 60% 70%);
		color: hsl(280 60% 30%);
	}

	.rule-select {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 1px solid hsl(280 60% 70% / 0.3);
		border-radius: 0.375rem;
		background: hsl(0 0% 100%);
		color: hsl(280 60% 30%);
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease;
		margin-bottom: 1rem;
	}

	.rule-select:hover {
		border-color: hsl(280 60% 70%);
		background: hsl(280 60% 70% / 0.05);
	}

	.rule-select:focus {
		outline: none;
		border-color: hsl(280 60% 70%);
		background: hsl(280 60% 70% / 0.05);
		box-shadow: 0 0 0 2px hsl(280 60% 70% / 0.2);
	}

	.rule-select option {
		padding: 0.5rem;
		color: hsl(280 60% 30%);
		background: hsl(0 0% 100%);
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.output-rule-selector {
			padding: 0.75rem;
		}
		
		.selector-container {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}
		
		.selector-column {
			gap: 0.375rem;
		}
		
		.selector-label {
			font-size: 0.8rem;
		}
		
		.rule-select {
			padding: 0.625rem 0.75rem;
			font-size: 0.8rem;
		}
	}
</style>