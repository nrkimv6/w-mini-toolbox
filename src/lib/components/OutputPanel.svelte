<script lang="ts">
	import { outputMarkdown, userOptions, isPreviewMode, inputHtml, selectedFormat, currentInputRule } from '$lib/stores/html-to-md.svelte.js';
	import { copyToClipboard, downloadAsFile, generateFilename } from '$lib/tools/html-to-md/converter/converter.js';
	import { autoClearAfterCopy, autoClearAfterDownload, showAutoClearNotification } from '$lib/tools/html-to-md/utils/autoClear.js';
	import { applyOutputRule } from '$lib/tools/html-to-md/converter/outputProcessor.js';
	import OutputRuleSelector, { type OutputRule } from './OutputRuleSelector.svelte';
	import { Clipboard, Download, FileText } from 'lucide-svelte';
	import { marked } from 'marked';

	let selectedOutputRule: OutputRule = 'raw';

	// 선택된 출력 규칙에 따라 처리된 마크다운
	$: processedMarkdown = $outputMarkdown ? applyOutputRule($outputMarkdown, selectedOutputRule, $selectedFormat, $currentInputRule) : '';

	// 미리보기를 위한 HTML 렌더링 (미리보기 모드일 때만)
	$: previewHtml = $isPreviewMode && processedMarkdown ? marked(processedMarkdown) : '';

	let copyButtonText = "복사";
	let downloadButtonText = "다운로드";

	async function handleCopy() {
		const success = await copyToClipboard(processedMarkdown);
		if (success) {
			copyButtonText = "복사됨";
			setTimeout(() => {
				copyButtonText = "복사";
			}, 2000);

			// Auto-clear if enabled
			if ($userOptions.autoClearAfterCopy) {
				showAutoClearNotification('copy');
				await autoClearAfterCopy();
			}
		} else {
			copyButtonText = "실패";
			setTimeout(() => {
				copyButtonText = "복사";
			}, 2000);
		}
	}

	async function handleDownload() {
		if (!processedMarkdown.trim()) {
			downloadButtonText = "내용 없음";
			setTimeout(() => {
				downloadButtonText = "다운로드";
			}, 2000);
			return;
		}

		const filename = generateFilename(processedMarkdown);
		downloadAsFile(processedMarkdown, filename);

		downloadButtonText = "다운로드됨";
		setTimeout(() => {
			downloadButtonText = "다운로드";
		}, 2000);

		// Auto-clear if enabled
		if ($userOptions.autoClearAfterDownload) {
			showAutoClearNotification('download');
			await autoClearAfterDownload();
		}
	}
</script>

<div class="output-panel">
	<div class="panel-header">
		<h3>출력</h3>
		<div class="button-group">
			<button class="copy-btn" onclick={handleCopy}>
				<Clipboard size={16} />
				{copyButtonText}
			</button>
			<button class="download-btn" onclick={handleDownload}>
				<Download size={16} />
				{downloadButtonText}
			</button>
		</div>
	</div>

	{#if $inputHtml.trim()}
		<OutputRuleSelector bind:selectedOutputRule />
	{/if}

	{#if $isPreviewMode && processedMarkdown.trim()}
		<div
			class="preview-content"
			class:has-content={processedMarkdown.trim().length > 0}
		>
			{@html previewHtml}
		</div>
	{:else}
		<textarea
			readonly
			value={processedMarkdown}
			placeholder="변환된 마크다운이 여기에 표시됩니다..."
			class:has-content={processedMarkdown.trim().length > 0}
		></textarea>
	{/if}
</div>

<style>
	.output-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		animation: gentleIn 0.4s ease-out 0.1s both;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid hsl(280 60% 70% / 0.2);
		background: hsl(280 60% 70% / 0.08);
	}

	.panel-header h3 {
		margin: 0;
		color: hsl(280 60% 30%);
		font-size: 1rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* Removed emoji before, replaced with icons inline */

	.button-group {
		display: flex;
		gap: 0.75rem;
	}

	.copy-btn,
	.download-btn {
		border: 1px solid hsl(280 60% 70% / 0.3);
		padding: 0.625rem 1rem;
		border-radius: 0.375rem;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 500;
		transition: all 0.2s ease;
		min-width: 90px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		min-height: 40px;
		background: hsl(0 0% 100%);
		color: hsl(280 60% 50%);
		box-shadow: 0 2px 8px -2px hsl(280 60% 70% / 0.2);
	}

	.copy-btn:hover,
	.download-btn:hover {
		background: hsl(280 60% 70% / 0.1);
		border-color: hsl(280 60% 70%);
		color: hsl(280 60% 40%);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px -3px hsl(280 60% 70% / 0.3);
	}

	/* Removed emoji ::before content since we're using icons inline */

	.copy-btn:active,
	.download-btn:active {
		transform: translateY(0);
	}

	textarea {
		flex: 1;
		width: 100%;
		padding: 1.25rem;
		border: none;
		resize: none;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'SFMono-Regular', 'Consolas', monospace;
		font-size: 0.875rem;
		line-height: 1.6;
		background: hsl(270 15% 18% / 0.02);
		color: hsl(260 15% 25%);
		outline: none;
		transition: all 0.2s ease;
		min-height: 200px;
	}

	textarea.has-content {
		min-height: calc(10 * 1.6em + 2.5rem);
	}

	textarea:focus {
		background: hsl(280 60% 70% / 0.02);
		box-shadow: inset 0 0 0 2px hsl(280 60% 70% / 0.3);
	}

	textarea::placeholder {
		color: hsl(260 20% 50%);
		font-style: italic;
	}

	textarea::-webkit-scrollbar {
		width: 8px;
	}

	textarea::-webkit-scrollbar-track {
		background: hsl(var(--muted));
		border-radius: 4px;
	}

	textarea::-webkit-scrollbar-thumb {
		background: hsl(var(--accent) / 0.4);
		border-radius: 4px;
	}

	textarea::-webkit-scrollbar-thumb:hover {
		background: hsl(var(--accent) / 0.6);
	}

	/* 미리보기 모드 스타일 */

	.preview-content {
		flex: 1;
		width: 100%;
		padding: 1.25rem;
		background: hsl(270 15% 18% / 0.02);
		color: hsl(260 15% 25%);
		overflow-y: auto;
		line-height: 1.6;
		min-height: 200px;
	}

	.preview-content.has-content {
		min-height: calc(10 * 1.6em + 2.5rem);
	}

	/* GitHub 스타일 마크다운 CSS */
	.preview-content :global(h1),
	.preview-content :global(h2),
	.preview-content :global(h3),
	.preview-content :global(h4),
	.preview-content :global(h5),
	.preview-content :global(h6) {
		margin-top: 1.5rem;
		margin-bottom: 0.75rem;
		font-weight: 600;
		color: hsl(260 15% 15%);
	}

	.preview-content :global(h1) {
		font-size: 1.75rem;
		border-bottom: 1px solid hsl(280 60% 70% / 0.3);
		padding-bottom: 0.5rem;
	}

	.preview-content :global(h2) {
		font-size: 1.5rem;
		border-bottom: 1px solid hsl(280 60% 70% / 0.2);
		padding-bottom: 0.5rem;
	}

	.preview-content :global(h3) {
		font-size: 1.25rem;
	}

	.preview-content :global(h4) {
		font-size: 1.1rem;
	}

	.preview-content :global(h5),
	.preview-content :global(h6) {
		font-size: 1rem;
	}

	.preview-content :global(p) {
		margin-bottom: 1rem;
	}

	.preview-content :global(ul),
	.preview-content :global(ol) {
		margin-bottom: 1rem;
		padding-left: 1.5rem;
	}

	.preview-content :global(li) {
		margin-bottom: 0.25rem;
	}

	.preview-content :global(blockquote) {
		border-left: 4px solid hsl(280 60% 70% / 0.5);
		padding-left: 1rem;
		margin: 1rem 0;
		color: hsl(260 15% 40%);
		background: hsl(280 60% 70% / 0.05);
		border-radius: 0 0.25rem 0.25rem 0;
	}

	.preview-content :global(pre) {
		background: hsl(220 20% 10%);
		color: hsl(220 20% 95%);
		padding: 1rem;
		border-radius: 0.375rem;
		overflow-x: auto;
		margin: 1rem 0;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'SFMono-Regular', 'Consolas', monospace;
		font-size: 0.875rem;
	}

	.preview-content :global(code) {
		background: hsl(280 60% 70% / 0.1);
		color: hsl(280 60% 40%);
		padding: 0.2rem 0.375rem;
		border-radius: 0.25rem;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'SFMono-Regular', 'Consolas', monospace;
		font-size: 0.85rem;
	}

	.preview-content :global(pre code) {
		background: none;
		color: inherit;
		padding: 0;
		border-radius: 0;
	}

	.preview-content :global(table) {
		border-collapse: collapse;
		width: 100%;
		margin: 1rem 0;
		border: 1px solid hsl(280 60% 70% / 0.3);
		border-radius: 0.375rem;
		overflow: hidden;
	}

	.preview-content :global(th),
	.preview-content :global(td) {
		padding: 0.75rem;
		border-bottom: 1px solid hsl(280 60% 70% / 0.2);
		text-align: left;
	}

	.preview-content :global(th) {
		background: hsl(280 60% 70% / 0.1);
		font-weight: 600;
		color: hsl(280 60% 30%);
	}

	.preview-content :global(tr:last-child th),
	.preview-content :global(tr:last-child td) {
		border-bottom: none;
	}

	.preview-content :global(a) {
		color: hsl(280 60% 50%);
		text-decoration: none;
		border-bottom: 1px solid transparent;
		transition: border-color 0.2s ease;
	}

	.preview-content :global(a:hover) {
		border-bottom-color: hsl(280 60% 50%);
	}

	.preview-content :global(hr) {
		border: none;
		height: 1px;
		background: hsl(280 60% 70% / 0.3);
		margin: 2rem 0;
	}

	.preview-content::-webkit-scrollbar {
		width: 8px;
	}

	.preview-content::-webkit-scrollbar-track {
		background: hsl(var(--muted));
		border-radius: 4px;
	}

	.preview-content::-webkit-scrollbar-thumb {
		background: hsl(var(--accent) / 0.4);
		border-radius: 4px;
	}

	.preview-content::-webkit-scrollbar-thumb:hover {
		background: hsl(var(--accent) / 0.6);
	}

	@keyframes gentleIn {
		0% { 
			transform: translateX(10px) scale(0.98); 
			opacity: 0; 
		}
		100% { 
			transform: translateX(0) scale(1); 
			opacity: 1; 
		}
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.panel-header {
			padding: 0.75rem;
			flex-wrap: wrap;
			gap: 0.5rem;
		}
		
		.panel-header h3 {
			font-size: 0.9rem;
			flex: 1;
		}
		
		.button-group {
			gap: 0.375rem;
			flex-wrap: wrap;
		}
		
		.copy-btn,
		.download-btn {
			padding: 0.625rem 1rem;
			font-size: 0.85rem;
			min-height: 40px;
		}
		
		textarea {
			padding: 0.75rem;
			font-size: 0.8rem;
		}
	}

	@media (max-width: 480px) {
		.panel-header {
			flex-direction: column;
			align-items: stretch;
			gap: 1rem;
		}
		
		.button-group {
			justify-content: stretch;
		}
		
		.copy-btn,
		.download-btn {
			flex: 1;
			min-width: auto;
		}
	}
</style>