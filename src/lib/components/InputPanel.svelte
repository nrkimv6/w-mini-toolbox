<script lang="ts">
	import { inputHtml, userOptions, currentInputRule, selectedFormat } from '$lib/stores/html-to-md.svelte.js';
	import { getAvailableRules, setSourceRule, type SourceRule } from '$lib/tools/html-to-md/converter/converter.js';
	import { readClipboardFormats, downloadFile, type ClipboardContent } from '$lib/tools/html-to-md/utils/clipboard.js';
	import { autoClearAfterDownload, showAutoClearNotification } from '$lib/tools/html-to-md/utils/autoClear.js';
	import { copyToClipboard } from '$lib/tools/html-to-md/converter/converter.js';
	import { onMount } from 'svelte';
	import {
		Clipboard,
		FileText,
		File,
		Trash2,
		ClipboardPaste,
		RefreshCw,
		Globe,
		Image,
		Download,
		ArrowUpDown
	} from 'lucide-svelte';
	import { performEnhancedDetection, getDetectionSummary, type EnhancedDetectionResult } from '$lib/tools/html-to-md/detector/enhancedDetector.js';

	let textareaElement: HTMLTextAreaElement;
	let clipboardFormats: ClipboardContent[] = [];
	let localSelectedFormat: string = '';
	let showFormatSelector = false;
	let loading = false;
	let showPasteHint = false;
	let permissionMessage = '';
	let showPermissionMessage = false;
	let copyButtonText = '';
	let detectionSummary: string = '';
	let detectionResult: EnhancedDetectionResult | null = null;

	// Debounce utility function
	function debounce<T extends (...args: any[]) => any>(fn: T, delay: number = 300): (...args: Parameters<T>) => void {
		let timeoutId: ReturnType<typeof setTimeout>;
		return (...args: Parameters<T>) => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => fn(...args), delay);
		};
	}

	// Debounced input handler
	const handleInput = debounce((value: string) => {
		inputHtml.set(value);
		// 텍스트 입력 시에도 감지 수행
		if (value.trim().length > 100) { // 최소 길이 체크
			performDetection(value);
		}
	}, 300);

	// Initialize copy button text
	$: copyButtonText = "복사";

	// Copy input content to clipboard
	async function handleCopyInput() {
		const success = await copyToClipboard($inputHtml);
		if (success) {
			copyButtonText = "복사됨";
			setTimeout(() => {
				copyButtonText = "복사";
			}, 2000);
		} else {
			copyButtonText = "실패";
			setTimeout(() => {
				copyButtonText = "복사";
			}, 2000);
		}
	}

	function clearInput() {
		inputHtml.set('');
		if (textareaElement) {
			textareaElement.value = '';
		}
		clipboardFormats = [];
		showFormatSelector = false;
	}

	async function loadClipboardFormats() {
		loading = true;
		showPermissionMessage = false;
		console.log('Loading clipboard formats...');
		
		try {
			clipboardFormats = await readClipboardFormats();
			console.log('Loaded clipboard formats:', clipboardFormats);
			
			// Check if we got an error format
			const errorFormat = clipboardFormats.find(f => f.type === 'error');
			if (errorFormat) {
				permissionMessage = errorFormat.content;
				showPermissionMessage = true;
				setTimeout(() => showPermissionMessage = false, 7000); // Hide after 7 seconds
				return;
			}
			
			if (clipboardFormats.length > 0) {
				// Auto-select HTML if available, otherwise first available format
				const htmlFormat = clipboardFormats.find(f => f.type === 'text/html' && f.available);
				const firstAvailable = clipboardFormats.find(f => f.available);
				
				if (htmlFormat) {
					selectFormat('text/html');
					// Enhanced detection 수행
					performDetection(htmlFormat.content);
				} else if (firstAvailable) {
					selectFormat(firstAvailable.type);
					// Enhanced detection 수행
					performDetection(firstAvailable.content);
				}
				
				// Show format selector if there are any available formats
				const availableFormats = clipboardFormats.filter(f => f.available);
				console.log('Available formats:', availableFormats.length);
				showFormatSelector = availableFormats.length > 0;
				console.log('showFormatSelector:', showFormatSelector);
				
				// Auto-scroll on mobile after successful paste
				if (availableFormats.length > 0) {
					setTimeout(() => {
						scrollToOutputOnMobile();
					}, 300);
				}
			}
		} catch (error) {
			console.error('Failed to load clipboard formats:', error);
			
			// Show error message to user
			permissionMessage = error instanceof Error ? error.message : '클립보드 읽기에 실패했습니다.';
			showPermissionMessage = true;
			setTimeout(() => showPermissionMessage = false, 7000);
		} finally {
			loading = false;
		}
	}

	function selectFormat(formatType: string) {
		const format = clipboardFormats.find(f => f.type === formatType);
		if (format && format.available) {
			localSelectedFormat = formatType;
			selectedFormat.set(formatType.includes('html') ? 'HTML' : 'Text');
			if (textareaElement) {
				textareaElement.value = format.content;
				handleInput(format.content);
				// Enhanced detection 수행
				performDetection(format.content);
				// Auto-scroll to output area after paste (mobile only)
				setTimeout(() => {
					scrollToOutputOnMobile();
				}, 300);
			}
		}
	}

	function getFormatIcon(type: string) {
		if (type === 'text/html') return Globe;
		if (type === 'text/plain') return FileText;
		if (type.startsWith('image/')) return Image;
		return Clipboard;
	}

	function getFormatSize(content: string): string {
		const sizeKB = Math.round(content.length / 1024);
		return sizeKB > 0 ? `${sizeKB}KB` : `${content.length}B`;
	}

	// Global keyboard event handler for Ctrl+V
	function handleGlobalKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
			// Only handle if not already in an input field
			const activeElement = document.activeElement;
			const isInInput = activeElement instanceof HTMLInputElement || 
							 activeElement instanceof HTMLTextAreaElement ||
							 activeElement?.getAttribute('contenteditable') === 'true';
			
			if (!isInInput) {
				event.preventDefault();
				showPasteHint = true;
				setTimeout(() => showPasteHint = false, 2000);
				loadClipboardFormats();
				
				// Auto-scroll on mobile after paste
				setTimeout(() => {
					scrollToOutputOnMobile();
				}, 500);
			}
		}
	}

	// Handle paste event on textarea
	function handleTextareaPaste(event: ClipboardEvent) {
		event.preventDefault();
		loadClipboardFormats();
	}

	// Enhanced detection 수행 함수
	function performDetection(htmlContent: string) {
		try {
			// 클립보드 데이터 구성
			const clipboardData: Record<string, string> = {};
			clipboardFormats.forEach(format => {
				if (format.available) {
					clipboardData[format.type] = format.content;
				}
			});

			// Enhanced detection 수행
			const result = performEnhancedDetection(clipboardData, htmlContent);
			detectionResult = result;
			detectionSummary = getDetectionSummary(result);
			
			// 자동 규칙 동기화 - 감지된 규칙을 자동 적용
			if (result.recommendedRule && result.overallConfidence > 0.7) {
				const mappedRule = mapDetectTypeToSourceRule(result.recommendedRule);
				if (mappedRule && mappedRule !== $currentInputRule) {
					console.log(`Auto-switching from ${$currentInputRule} to ${mappedRule} (confidence: ${result.overallConfidence})`);
					setSourceRule(mappedRule);
					currentInputRule.set(mappedRule);
				}
			}
		} catch (error) {
			console.error('Detection failed:', error);
			detectionSummary = '';
			detectionResult = null;
		}
	}

	// 감지된 입력 타입을 입력 규칙으로 매핑하는 함수
	function mapDetectTypeToSourceRule(detectType: string): SourceRule | null {
		if (detectType.includes('gemini')) return 'gemini';
		if (detectType.includes('notion')) return 'notion';
		if (detectType.includes('claude')) return 'claude';
		if (detectType.includes('chatgpt')) return 'chatgpt';
		if (detectType.includes('generic')) return 'default';
		return 'default'; // fallback
	}

	// 모바일에서 출력 패널로 스크롤하는 함수
	function scrollToOutputOnMobile() {
		// 모바일에서만 동작 (768px 이하)
		if (window.innerWidth > 768) return;

		const outputPanel = document.querySelector('.output-panel .panel-header');
		if (outputPanel) {
			// 출력 패널 헤더(복사/다운로드 버튼 영역)가 화면 상단에 오도록 스크롤
			outputPanel.scrollIntoView({
				behavior: 'smooth',
				block: 'start'
			});
		}
	}

	onMount(() => {
		
		// Add global keydown listener
		document.addEventListener('keydown', handleGlobalKeydown);

		return () => {
			document.removeEventListener('keydown', handleGlobalKeydown);
		};
	});
</script>

<div class="input-panel">
	<div class="panel-header">
		<h3>입력</h3>
		<div class="header-buttons">
			<button class="paste-btn" on:click={loadClipboardFormats} disabled={loading}>
				{#if loading}
					<RefreshCw class="spin" size={16} />
					로딩...
				{:else}
					<ClipboardPaste size={16} />
					붙여넣기
				{/if}
			</button>
			<button class="clear-btn" on:click={clearInput}>
				<Trash2 size={16} />
				지우기
			</button>
			{#if showPasteHint}
				<div class="paste-hint">
					📋 붙여넣기 감지됨
				</div>
			{/if}
			{#if showPermissionMessage}
				<div class="permission-message">
					🔒 {permissionMessage}
				</div>
			{/if}
		</div>
	</div>

{#if showFormatSelector && clipboardFormats.length > 0}
		<div class="format-selector">
			<div class="format-selector-header">
				<div class="left-section">
					<span class="format-label">
						<ArrowUpDown size={16} />
						클립보드 포맷
					</span>
					<span class="format-count">{clipboardFormats.filter(f => f.available).length}개 사용 가능</span>
				</div>
				{#if detectionSummary && detectionResult}
					<div class="detection-summary" class:high-confidence={detectionResult.overallConfidence >= 0.8} class:medium-confidence={detectionResult.overallConfidence >= 0.6 && detectionResult.overallConfidence < 0.8} class:low-confidence={detectionResult.overallConfidence < 0.6}>
						<span class="detection-icon">🔍</span>
						<span class="detection-text">{detectionSummary}</span>
					</div>
				{/if}
			</div>
			<div class="format-buttons">
				{#each clipboardFormats as format}
					{#if format.available}
						<div class="format-item">
							<button
								class="format-btn"
								class:active={localSelectedFormat === format.type}
								on:click={() => selectFormat(format.type)}
								title={`${format.label} - ${getFormatSize(format.content)}`}
							>
								<span class="format-icon">
									<svelte:component this={getFormatIcon(format.type)} size={18} />
								</span>
								<span class="format-name">{format.label}</span>
								<span class="format-size">({getFormatSize(format.content)})</span>
							</button>
							{#if format.isFile}
								<button
									class="download-btn"
									on:click={async () => {
										try {
											await downloadFile(format);
											if ($userOptions.autoClearAfterDownload) {
												showAutoClearNotification('download');
												await autoClearAfterDownload();
											}
										} catch (error) {
											console.error('Download failed:', error);
										}
									}}
									title={`Download ${format.fileName}`}
								>
									<Download size={14} />
								</button>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}


	<div class="textarea-wrapper">
		<textarea
			bind:this={textareaElement}
			placeholder="HTML을 붙여넣으세요..."
			on:input={(e) => handleInput((e.target as HTMLTextAreaElement)?.value ?? '')}
			on:paste={handleTextareaPaste}
			class:has-content={$inputHtml.trim().length > 0}
		></textarea>
		{#if $inputHtml.trim().length > 0}
			<button
				class="copy-input-btn"
				on:click={handleCopyInput}
				title={copyButtonText}
			>
				<Clipboard size={16} />
			</button>
		{/if}
	</div>

</div>

<style>
	.input-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		animation: gentleIn 0.4s ease-out;
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

	/* Icon styling for spin animation */
	:global(.spin) {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.header-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.paste-btn, .clear-btn {
		border: 1px solid hsl(280 60% 70% / 0.2);
		padding: 0.625rem 1rem;
		border-radius: 0.375rem;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 500;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		min-height: 40px;
	}

	.paste-btn {
		background: hsl(280 60% 70%);
		color: hsl(0 0% 100%);
		box-shadow: 0 2px 8px -2px hsl(280 60% 70% / 0.3);
	}

	.paste-btn:hover {
		background: hsl(280 60% 60%);
		border-color: hsl(280 60% 60%);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px -3px hsl(280 60% 70% / 0.4);
	}

	.clear-btn {
		background: hsl(0 0% 100%);
		color: hsl(280 60% 50%);
		border: 1px solid hsl(280 60% 70% / 0.3);
	}

	.clear-btn:hover {
		background: hsl(280 60% 70% / 0.1);
		border-color: hsl(280 60% 70%);
		transform: translateY(-1px);
		box-shadow: 0 2px 8px -2px hsl(280 60% 70% / 0.2);
	}

	.paste-btn:active, .clear-btn:active {
		transform: translateY(0);
	}

	.textarea-wrapper {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
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
		background: hsl(0 0% 100%);
		color: hsl(260 15% 25%);
		outline: none;
		transition: all 0.2s ease;
		min-height: 200px;
	}

	.copy-input-btn {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		width: 2rem;
		height: 2rem;
		border: none;
		border-radius: 0.375rem;
		background: hsl(280 60% 70% / 0.9);
		color: hsl(0 0% 100%);
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 8px -2px hsl(280 60% 70% / 0.3);
		backdrop-filter: blur(4px);
		z-index: 10;
	}

	.copy-input-btn:hover {
		background: hsl(280 60% 60%);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px -3px hsl(280 60% 70% / 0.4);
	}

	.copy-input-btn:active {
		transform: translateY(0);
	}

	textarea.has-content {
		min-height: calc(10 * 1.6em + 2.5rem);
	}

	textarea:focus {
		background: hsl(270 20% 98%);
		box-shadow: inset 0 0 0 2px hsl(280 60% 70% / 0.2);
	}

	textarea::placeholder {
		color: hsl(260 20% 50%);
		font-style: italic;
	}

	textarea::-webkit-scrollbar {
		width: 8px;
	}

	textarea::-webkit-scrollbar-track {
		background: hsl(280 60% 70% / 0.1);
		border-radius: 4px;
	}

	textarea::-webkit-scrollbar-thumb {
		background: hsl(280 60% 70% / 0.3);
		border-radius: 4px;
	}

	textarea::-webkit-scrollbar-thumb:hover {
		background: hsl(280 60% 70% / 0.5);
	}

	.format-selector {
		border-bottom: 1px solid hsl(280 60% 70% / 0.2);
		background: hsl(280 60% 70% / 0.05);
		animation: slideDown 0.3s ease-out;
		padding: 0.75rem 0;
	}

	.format-selector-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem 0.5rem 1rem;
		gap: 1rem;
	}
	
	.left-section {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.format-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	/* Remove emoji styling since we're using icons */

	.format-count {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
		background: hsl(var(--accent) / 0.2);
		padding: 0.125rem 0.5rem;
		border-radius: calc(var(--radius) / 2);
		border: 1px solid hsl(var(--border));
	}
	

	.detection-summary {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.375rem 0.75rem;
		border-radius: calc(var(--radius) / 2);
		border: 1px solid;
		white-space: nowrap;
		flex: 1;
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
	}

	.detection-summary.high-confidence {
		color: hsl(120 60% 40%);
		background: hsl(120 60% 40% / 0.08);
		border-color: hsl(120 60% 40% / 0.2);
	}

	.detection-summary.medium-confidence {
		color: hsl(45 70% 40%);
		background: hsl(45 70% 40% / 0.08);
		border-color: hsl(45 70% 40% / 0.2);
	}

	.detection-summary.low-confidence {
		color: hsl(15 70% 50%);
		background: hsl(15 70% 50% / 0.08);
		border-color: hsl(15 70% 50% / 0.2);
	}

	.detection-icon {
		font-size: 0.875rem;
		opacity: 0.8;
	}

	.detection-text {
		font-weight: 600;
	}

	.format-buttons {
		display: flex;
		gap: 0.5rem;
		padding: 0 1rem 0.75rem 1rem;
		flex-wrap: wrap;
	}

	.format-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.format-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		background: hsl(var(--background));
		border: 2px solid hsl(var(--border));
		border-radius: var(--radius);
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 500;
		transition: all 0.2s ease;
		color: hsl(var(--foreground));
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.format-btn:hover {
		border-color: hsl(var(--ring));
		background: hsl(var(--accent) / 0.1);
		transform: translateY(-1px);
		box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
	}

	.format-btn.active {
		border-color: hsl(var(--primary));
		background: linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.05));
		color: hsl(var(--primary));
		box-shadow: 0 0 0 1px hsl(var(--primary) / 0.2);
	}

	.format-btn.active .format-icon {
		filter: brightness(1.2);
	}

	.format-icon {
		font-size: 1.2em;
		line-height: 1;
	}

	.format-name {
		font-weight: 600;
	}

	.format-size {
		color: hsl(var(--muted-foreground));
		font-size: 0.75rem;
		margin-left: 0.25rem;
	}

	.format-btn.active .format-size {
		color: hsl(var(--primary) / 0.8);
	}

	.download-btn {
		padding: 0.25rem 0.5rem;
		background: hsl(var(--secondary));
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius);
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s ease;
		color: hsl(var(--secondary-foreground));
		min-width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.download-btn:hover {
		background: hsl(var(--accent));
		border-color: hsl(var(--ring));
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.download-btn:active {
		transform: translateY(0);
	}

	.paste-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}

	.paste-btn:disabled:hover {
		transform: none;
		box-shadow: 0 2px 8px -2px hsl(var(--primary) / 0.3);
	}

	.paste-hint {
		position: absolute;
		top: 100%;
		right: 0;
		background: hsl(280 60% 70%);
		color: hsl(0 0% 100%);
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
		z-index: 10;
		animation: fadeInOut 2s ease-out;
		box-shadow: 0 4px 12px hsl(280 60% 70% / 0.3);
	}

	.permission-message {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: hsl(20 90% 60%);
		color: hsl(0 0% 100%);
		padding: 0.75rem 1rem;
		border-radius: 0.375rem;
		font-size: 0.8rem;
		font-weight: 600;
		text-align: center;
		z-index: 10;
		animation: slideDown 0.3s ease-out;
		box-shadow: 0 4px 12px hsl(20 90% 60% / 0.3);
		margin-top: 0.5rem;
		max-width: 100%;
		word-wrap: break-word;
	}

	.header-buttons {
		position: relative;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
			max-height: 0;
		}
		to {
			opacity: 1;
			transform: translateY(0);
			max-height: 200px;
		}
	}

	@keyframes fadeInOut {
		0% {
			opacity: 0;
			transform: translateY(-5px) scale(0.9);
		}
		20%, 80% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
		100% {
			opacity: 0;
			transform: translateY(-5px) scale(0.9);
		}
	}


	@keyframes gentleIn {
		0% { 
			transform: translateX(-10px) scale(0.98); 
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
		}
		
		.panel-header h3 {
			font-size: 0.9rem;
		}
		
		.paste-btn, .clear-btn {
			padding: 0.75rem 1rem;
			font-size: 0.875rem;
			min-height: 44px;
		}
		
		.format-selector-header {
			padding: 0.5rem 0.75rem 0.375rem 0.75rem;
			flex-direction: column;
			align-items: stretch;
			gap: 0.5rem;
		}
		
		.left-section {
			justify-content: space-between;
		}
		
		
		.format-label {
			font-size: 0.8rem;
		}
		
		.format-count {
			font-size: 0.7rem;
		}
		
		.detection-summary {
			font-size: 0.7rem;
			padding: 0.25rem 0.5rem;
			align-self: stretch;
			text-align: center;
			flex: 1;
		}
		
		.format-buttons {
			padding: 0 0.75rem 0.5rem 0.75rem;
			gap: 0.375rem;
		}
		
		.format-btn {
			padding: 0.375rem 0.5rem;
			font-size: 0.75rem;
		}
		
		.format-name {
			display: none;
		}
		
		.format-icon {
			font-size: 1.1em;
		}

		.download-btn {
			min-width: 1.75rem;
			height: 1.75rem;
			padding: 0.125rem 0.25rem;
			font-size: 0.8rem;
		}
		
		textarea {
			padding: 0.75rem;
			font-size: 0.8rem;
		}

		.copy-input-btn {
			top: 0.5rem;
			right: 0.5rem;
			width: 1.75rem;
			height: 1.75rem;
			font-size: 0.8rem;
		}
	}
</style>