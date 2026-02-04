<script lang="ts">
	import { userOptions } from '$lib/stores/html-to-md.svelte.js';
	import RuleSelector from './RuleSelector.svelte';

	let isExpanded = $state(false);

	function togglePanel() {
		isExpanded = !isExpanded;
	}

	function handleOptionToggle(option: 'autoClearAfterCopy' | 'autoClearAfterDownload' | 'autoSaveInput') {
		userOptions.update(current => ({
			...current,
			[option]: !current[option]
		}));
	}

	function resetOptions() {
		// Reset to default options
		userOptions.set({
			autoClearAfterCopy: false,
			autoClearAfterDownload: true,
			autoSaveInput: false
		});
		// Reset expanded state to default
		isExpanded = false;
	}
</script>

<div class="options-panel">
	<RuleSelector 
		{isExpanded} 
		on:toggleSettings={togglePanel}
	/>
	
	{#if isExpanded}
		<div id="options-content" class="options-content">
			<!-- 일단 숨김 -->
			<!-- <div class="options-header">
				<h4>추가 설정</h4>
				<button class="reset-btn" on:click={resetOptions} title="초기화">
					🔄
				</button>
			</div> -->
			
			<div class="options-grid">
				<div class="option-item">
					<label class="option-label">
						<input 
							type="checkbox" 
							checked={$userOptions.autoClearAfterCopy}
							on:change={() => handleOptionToggle('autoClearAfterCopy')}
						/>
						<div class="option-info">
							<span class="option-title">📋 복사 후 자동 지우기</span>
							<!-- 상세 내용 가리기 -->
							<!-- <span class="option-description">복사 후 자동 지우기 설명</span> -->
						</div>
					</label>
				</div>
				
				<div class="option-item">
					<label class="option-label">
						<input 
							type="checkbox" 
							checked={$userOptions.autoClearAfterDownload}
							on:change={() => handleOptionToggle('autoClearAfterDownload')}
						/>
						<div class="option-info">
							<span class="option-title">💾 다운로드 후 자동 지우기</span>
							<!-- 상세 내용 가리기 -->
							<!-- <span class="option-description">다운로드 후 자동 지우기 설명</span> -->
						</div>
					</label>
				</div>
				
				<div class="option-item">
					<label class="option-label">
						<input 
							type="checkbox" 
							checked={$userOptions.autoSaveInput}
							on:change={() => handleOptionToggle('autoSaveInput')}
						/>
						<div class="option-info">
							<span class="option-title">💽 입력 자동 저장</span>
							<!-- 상세 내용 가리기 -->
							<!-- <span class="option-description">입력 자동 저장 설명</span> -->
						</div>
					</label>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.options-panel {
		background: hsl(0 0% 100%);
		border: 1px solid hsl(280 60% 70% / 0.15);
		border-radius: 0.75rem;
		overflow: visible;
		margin: 0 auto;
		box-shadow: 0 2px 8px -3px hsl(280 60% 70% / 0.15);
		transition: all 0.3s ease;
		width: 100%;
		max-width: min(1200px, calc(100vw - 2rem));
		min-width: min(1200px, calc(100vw - 2rem));
		position: relative;
		z-index: 100;
	}
	
	/* Removed main-controls - now handled in RuleSelector */
	
	/* RuleSelector will now take more space and handle its own styling */

	.options-panel:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 25px -8px hsl(280 60% 70% / 0.3);
	}
	
	/* Toggle button styles moved to RuleSelector */
	
	/* Toggle button hover styles moved to RuleSelector */
	
	
	.icon {
		font-size: 0.75rem;
		transition: transform 0.2s;
	}
	
	.options-content {
		padding: 0 1.5rem 1.5rem 1.5rem;
		background: hsl(0 0% 100%);
		animation: slideDown 0.3s ease-out;
		border-top: 1px solid hsl(280 60% 70% / 0.1);
		margin-top: 0.5rem;
	}
	
	.options-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		align-items: start;
	}
	
	.options-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}
	
	.options-header h4 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: hsl(var(--foreground));
	}
	
	.reset-btn {
		padding: 0.25rem 0.5rem;
		background: transparent;
		border: 1px solid hsl(var(--border));
		border-radius: calc(var(--radius) / 2);
		cursor: pointer;
		font-size: 0.8rem;
		color: hsl(var(--muted-foreground));
		transition: all 0.2s;
	}
	
	.reset-btn:hover {
		background: hsl(var(--secondary));
		color: hsl(var(--secondary-foreground));
		transform: translateY(-1px);
	}
	
	.option-item {
		margin-bottom: 0;
	}
	
	.option-label {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		cursor: pointer;
		padding: 0.75rem 0.5rem;
		transition: all 0.2s ease;
	}
	
	.option-label:hover {
		opacity: 0.8;
	}
	
	.option-label input[type="checkbox"] {
		margin: 0;
		cursor: pointer;
		transform: scale(1.1);
		flex-shrink: 0;
	}
	
	.option-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		text-align: center;
	}
	
	.option-title {
		font-size: 0.875rem;
		font-weight: 500;
		color: hsl(var(--foreground));
		line-height: 1.2;
	}
	
	.option-description {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
		line-height: 1.4;
	}
	
	.option-section {
		padding: 0.75rem 0.5rem;
		transition: all 0.2s ease;
	}
	
	.option-section:hover {
		opacity: 0.8;
	}
	
	.section-title {
		display: inline-block;
		font-size: 0.875rem;
		font-weight: 500;
		color: hsl(var(--foreground));
		margin-bottom: 0.75rem;
		line-height: 1.2;
	}
	
	
	/* Removed .language-container as we're no longer using a wrapper */
	
	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
			max-height: 0;
		}
		to {
			opacity: 1;
			transform: translateY(0);
			max-height: 300px;
		}
	}
	
	/* Mobile responsive */
	@media (max-width: 768px) {
		.options-panel {
			min-width: unset;
		}
		
		.options-content {
			padding: 0.75rem;
		}
		
		.options-grid {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}
		
		.options-header h4 {
			font-size: 0.85rem;
		}
		
		.option-label {
			padding: 0.5rem 0.25rem;
			gap: 0.5rem;
		}
		
		.option-title {
			font-size: 0.75rem;
		}
		
		.option-description {
			font-size: 0.65rem;
		}
		
		.option-section {
			padding: 0.5rem 0.25rem;
		}
		
		
		.section-title {
			font-size: 0.75rem;
			margin-bottom: 0.5rem;
		}
	}
</style>