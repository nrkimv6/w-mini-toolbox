<script lang="ts">
	import InputPanel from '$lib/components/InputPanel.svelte';
	import OutputPanel from '$lib/components/OutputPanel.svelte';
	import OptionsPanel from '$lib/components/OptionsPanel.svelte';
	import { inputHtml, outputMarkdown, isConverting, currentInputRule, warningMessage } from '$lib/stores/html-to-md.svelte.js';
	import { convertHtmlToMarkdown } from '$lib/tools/html-to-md/converter/converter.js';
	import { detectContentType } from '$lib/tools/html-to-md/detector/contentDetector.js';
	import { AlertTriangle, FileText } from 'lucide-svelte';
	import type { SourceRule } from '$lib/tools/html-to-md/converter/converter.js';

	// Local state for reactive updates
	let htmlValue = $state('');
	let ruleValue = $state<SourceRule>('default');

	// Subscribe to stores
	$effect(() => {
		const unsubscribeHtml = inputHtml.subscribe(value => htmlValue = value);
		const unsubscribeRule = currentInputRule.subscribe(value => ruleValue = value);

		return () => {
			unsubscribeHtml();
			unsubscribeRule();
		};
	});

	// 실시간 변환 처리 (Svelte 5 $effect 사용)
	$effect(() => {
		if (htmlValue || ruleValue) {
			if (htmlValue) {
				isConverting.set(true);
				try {
					// 입력 내용 감지 수행
					const detectionResult = detectContentType(htmlValue);

					// 경고 메시지가 있으면 설정
					if (detectionResult.warning) {
						warningMessage.set(detectionResult.warning);
					} else {
						warningMessage.set('');
					}

					// HTML을 Markdown으로 변환
					const result = convertHtmlToMarkdown(htmlValue);
					outputMarkdown.set(result);
				} catch (error) {
					console.error('Conversion failed:', error);
					outputMarkdown.set('Error: Failed to convert HTML');
					warningMessage.set('');
				} finally {
					isConverting.set(false);
				}
			} else {
				outputMarkdown.set('');
				warningMessage.set('');
			}
		}
	});
</script>

<svelte:head>
	<title>HTML → Markdown 변환기</title>
	<meta name="description" content="HTML을 깔끔한 마크다운으로 변환" />
</svelte:head>

<div class="app">
	<!-- 헤더 -->
	<header class="app-header">
		<div class="title-section">
			<div class="title-with-icon">
				<div class="icon-wrapper">
					<FileText class="h-6 w-6 text-purple-600" />
				</div>
				<h1>HTML → Markdown</h1>
			</div>
			<p class="description">HTML을 깔끔한 마크다운으로 변환하세요</p>
		</div>
	</header>

	<!-- 경고 메시지 배너 -->
	{#if $warningMessage}
		<div class="warning-banner">
			<div class="warning-content">
				<AlertTriangle size={20} />
				<span class="warning-text">{$warningMessage}</span>
				<button class="warning-close" onclick={() => warningMessage.set('')}>×</button>
			</div>
		</div>
	{/if}

	<!-- 메인 패널 -->
	<main class="main-content">
		<div class="panels-container">
			<div class="panel-wrapper">
				<InputPanel />
			</div>
			<div class="panel-wrapper">
				<OutputPanel />
			</div>
		</div>
	</main>

	<!-- 옵션 패널 -->
	<div class="options-section">
		<OptionsPanel />
	</div>

	<!-- 푸터 -->
	<footer class="app-footer">
		<p class="footer-text">Notion, Claude, ChatGPT, Gemini 등 다양한 소스를 지원합니다</p>
	</footer>
</div>

<style>
	.app {
		min-height: 100dvh;
		max-height: 100dvh;
		display: flex;
		flex-direction: column;
		padding: 2rem 1rem;
		box-sizing: border-box;
		background: linear-gradient(180deg, hsl(280 50% 98%) 0%, hsl(280 40% 96%) 100%);
		overflow: hidden;
	}

	.app-header {
		padding: 2rem 2rem 1.5rem 2rem;
		text-align: center;
		box-shadow: 0 4px 15px -5px hsl(280 60% 70% / 0.2);
		transition: all 0.3s ease;
		max-width: min(1200px, calc(100vw - 2rem));
		margin: 0 auto 1.5rem auto;
		width: 100%;
	}

	.app-header:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 25px -8px hsl(280 60% 70% / 0.25);
	}

	.title-section {
		text-align: center;
	}

	.title-with-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.icon-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.5rem;
		background: hsl(280 60% 70% / 0.15);
	}

	h1 {
		margin: 0;
		color: hsl(260 15% 25%);
		font-size: 2rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		animation: gentleIn 0.6s ease-out;
	}

	.description {
		margin: 0;
		color: hsl(260 20% 50%);
		font-size: 1rem;
		line-height: 1.6;
		animation: gentleIn 0.6s ease-out 0.1s both;
	}

	/* 경고 배너 스타일 */
	.warning-banner {
		background: hsl(30 90% 96%);
		border: 1px solid hsl(30 90% 85%);
		border-radius: 0.75rem;
		margin: 0 auto 1rem auto;
		max-width: min(1200px, calc(100vw - 2rem));
		animation: slideDown 0.3s ease-out;
	}

	.warning-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
	}

	.warning-content :global(svg) {
		color: hsl(30 90% 50%);
		flex-shrink: 0;
	}

	.warning-text {
		flex: 1;
		color: hsl(30 60% 30%);
		font-size: 0.9rem;
		font-weight: 500;
		line-height: 1.4;
	}

	.warning-close {
		background: none;
		border: none;
		color: hsl(30 60% 40%);
		font-size: 1.5rem;
		font-weight: bold;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		transition: all 0.2s ease;
		line-height: 1;
		flex-shrink: 0;
	}

	.warning-close:hover {
		background: hsl(30 90% 90%);
		color: hsl(30 60% 20%);
	}

	@keyframes slideDown {
		from {
			transform: translateY(-100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.panels-container {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		flex: 1;
		min-height: 0;
		max-height: 100%;
		animation: gentleIn 0.6s ease-out 0.2s both;
		max-width: min(1200px, calc(100vw - 2rem));
		margin: 0 auto;
		width: 100%;
	}

	.panel-wrapper {
		background: hsl(0 0% 100%);
		border: 1px solid hsl(270 20% 90%);
		border-radius: 0.75rem;
		overflow: hidden;
		box-shadow: 0 4px 15px -5px hsl(280 60% 70% / 0.2);
		transition: all 0.3s ease;
		position: relative;
		display: flex;
		flex-direction: column;
		min-height: 0;
		max-height: 100%;
	}

	.panel-wrapper:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 25px -8px hsl(280 60% 70% / 0.25);
	}

	.options-section {
		max-width: min(1200px, calc(100vw - 2rem));
		margin: 1rem auto 0 auto;
		width: 100%;
		animation: gentleIn 0.6s ease-out 0.3s both;
	}

	.app-footer {
		display: flex;
		justify-content: center;
		padding: 1rem;
		animation: gentleIn 0.6s ease-out 0.4s both;
	}

	.footer-text {
		margin: 0;
		color: hsl(260 20% 60%);
		font-size: 0.875rem;
		text-align: center;
	}

	/* 반응형 디자인 */
	@media (max-width: 1024px) {
		.panels-container {
			gap: 1rem;
		}

		.app {
			min-height: 100dvh;
			max-height: 100dvh;
			padding: 1.5rem 0.75rem;
		}
	}

	@media (max-width: 768px) {
		.panels-container {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr 1fr;
			gap: 1rem;
		}

		.app {
			min-height: 100dvh;
			max-height: 100dvh;
			padding: 1rem 0.5rem;
		}

		.app-header {
			padding: 1.5rem 1rem 0.5rem 1rem;
			margin-bottom: 1rem;
		}

		h1 {
			font-size: 1.75rem;
		}

		.title-with-icon {
			gap: 0.75rem;
		}

		.description {
			font-size: 0.9rem;
		}
	}

	@media (max-width: 480px) {
		.panels-container {
			gap: 0.75rem;
		}

		.app {
			min-height: 100dvh;
			max-height: 100dvh;
			padding: 0.75rem 0.375rem;
		}

		.app-header {
			padding: 1.25rem 0.75rem 0.5rem 0.75rem;
			margin-bottom: 0.75rem;
		}

		h1 {
			font-size: 1.5rem;
		}

		.description {
			font-size: 0.85rem;
		}
	}

	/* Landscape 모바일에서는 side-by-side 레이아웃 유지 */
	@media (max-width: 768px) and (orientation: landscape) {
		.panels-container {
			grid-template-columns: 1fr 1fr;
			grid-template-rows: 1fr;
		}

		.app {
			padding: 0.25rem;
		}

		.app-header {
			padding: 0.75rem 1rem;
			margin-bottom: 0.25rem;
		}
	}

	@keyframes gentleIn {
		0% {
			transform: translateY(10px) scale(0.98);
			opacity: 0;
		}
		100% {
			transform: translateY(0) scale(1);
			opacity: 1;
		}
	}
</style>
