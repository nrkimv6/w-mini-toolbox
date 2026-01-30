<script lang="ts">
	import { currentInputRule, inputHtml } from '$lib/stores/html-to-md.svelte.js';
	import { getAvailableRules, setSourceRule, getLastDetectionResult, getEffectiveRule, type SourceRule } from '$lib/tools/html-to-md/converter/converter.js';
	import { createEventDispatcher } from 'svelte';
	import { Settings, ChevronUp, ChevronDown, Wand2 } from 'lucide-svelte';

	export let isExpanded = false;
	const dispatch = createEventDispatcher();

	function handleSettingsToggle() {
		dispatch('toggleSettings');
	}

	const availableRules = getAvailableRules();
	let detectedRule: string = '';
	let detectionConfidence: number = 0;

	function handleRuleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const newRule = target.value as SourceRule;
		currentInputRule.set(newRule);
		setSourceRule(newRule);
		updateDetectionInfo();
	}

	function updateDetectionInfo() {
		const detection = getLastDetectionResult();
		if ($currentInputRule === 'default' && detection) {
			const effectiveRule = getEffectiveRule();
			const ruleConfig = availableRules.find(r => r.key === effectiveRule);
			detectedRule = ruleConfig ? ruleConfig.name : '';
			detectionConfidence = Math.round(detection.confidence * 100);
		} else {
			detectedRule = '';
			detectionConfidence = 0;
		}
	}

	// React to input changes to update detection info
	$: if ($inputHtml) {
		// Small delay to let conversion happen first
		setTimeout(updateDetectionInfo, 100);
	}

	// React to rule changes
	$: if ($currentInputRule) {
		updateDetectionInfo();
	}
</script>

<div class="settings-box">
	<div class="rule-content">
		<label for="rule-select" class="rule-label">설정</label>
		<!-- <label for="rule-select" class="rule-label">변환 규칙:</label>
		<select
			id="rule-select"
			class="rule-select"
			value={$currentInputRule}
			on:change={handleRuleChange}
		>
			{#each availableRules as rule}
				<option value={rule.key} title={rule.description}>
					{rule.name}
				</option>
			{/each}
		</select>

		{#if $currentInputRule === 'auto' && detectedRule}
			<div class="detection-info" title="자동으로 감지됨">
				<Wand2 size={14} />
				<span class="detected-rule">{detectedRule}</span>
				<span class="confidence">({detectionConfidence}%)</span>
			</div>
		{/if} -->

		<button
			class="settings-toggle"
			on:click={handleSettingsToggle}
			aria-expanded={isExpanded}
			aria-label="설정"
			title="설정"
		>
			<Settings size={16} />
			{#if isExpanded}
				<ChevronUp size={14} />
			{:else}
				<ChevronDown size={14} />
			{/if}
		</button>
	</div>
</div>

<style>
	.settings-box {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid hsl(280 60% 70% / 0.2);
		background: hsl(280 60% 70% / 0.08);
		animation: gentleIn 0.4s ease-out;
	}

	.rule-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: nowrap;
		flex: 1;
	}

	.settings-box:hover {
		/* Remove hover effects for integrated design */
	}

	.rule-label {
		margin: 0;
		color: hsl(280 60% 30%);
		font-size: 1rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		white-space: nowrap;
	}

	.rule-label::before {
		content: '⚙️';
		font-size: 1.1em;
	}

	.settings-toggle {
		padding: 0.25rem;
		background: transparent;
		border: none;
		border-radius: 0.25rem;
		cursor: pointer;
		font-size: 0.75rem;
		color: hsl(280 60% 50%);
		transition: all 0.15s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.125rem;
		width: auto;
		min-width: 32px;
		height: 20px;
		flex-shrink: 0;
		opacity: 0.7;
	}

	.settings-toggle:hover {
		background: hsl(280 60% 70% / 0.1);
		opacity: 1;
		transform: scale(1.1);
	}

	.settings-toggle:focus {
		outline: none;
		background: hsl(280 60% 70% / 0.15);
		opacity: 1;
	}

	/* Removed settings-icon class - using direct text content */

	.rule-select {
		padding: 0.75rem 1rem;
		border: 1px solid hsl(280 60% 70% / 0.15);
		border-radius: 0.5rem;
		background: hsl(0 0% 100%);
		color: hsl(280 60% 40%);
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		min-width: 160px;
		box-shadow: 0 1px 3px -1px hsl(280 60% 70% / 0.1);
		flex: 1;
	}

	.rule-select:hover {
		border-color: hsl(280 60% 70% / 0.25);
		background: hsl(280 60% 70% / 0.05);
		box-shadow: 0 2px 6px -2px hsl(280 60% 70% / 0.15);
	}

	.rule-select:focus {
		outline: none;
		border-color: hsl(280 60% 70% / 0.4);
		background: hsl(280 60% 70% / 0.05);
		box-shadow: 0 0 0 2px hsl(280 60% 70% / 0.15);
	}

	.detection-info {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		color: hsl(280 60% 50%);
		animation: slideIn 0.3s ease-out;
		white-space: nowrap;
	}

	.detected-rule {
		font-weight: 600;
		color: hsl(120 60% 40%);
	}

	.confidence {
		font-size: 0.7rem;
		color: hsl(280 60% 60%);
		font-weight: 500;
	}

	@keyframes gentleIn {
		0% { 
			transform: translateY(-5px) scale(0.98); 
			opacity: 0; 
		}
		100% { 
			transform: translateY(0) scale(1); 
			opacity: 1; 
		}
	}

	@keyframes slideIn {
		0% {
			opacity: 0;
			transform: translateX(-10px);
		}
		100% {
			opacity: 1;
			transform: translateX(0);
		}
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.settings-box {
			padding: 0.875rem 1rem;
			min-width: unset;
		}

		.settings-box {
			padding: 0.75rem;
		}
		
		.rule-label {
			font-size: 0.9rem;
		}
		
		.rule-content {
			flex-direction: row;
			align-items: center;
			gap: 0.5rem;
			width: 100%;
			flex-wrap: wrap;
		}
		
		.rule-select {
			flex: 1;
			min-width: 120px;
		}
		
		.settings-toggle {
			width: 24px;
			height: 24px;
			font-size: 0.7rem;
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
		.rule-label {
			font-size: 0.8rem;
			text-align: left;
			flex-shrink: 0;
			white-space: nowrap;
		}
		
		.rule-select {
			font-size: 0.8rem;
			min-width: unset;
			flex: 1;
			padding: 0.5rem 0.75rem;
		}

		.detection-info {
			font-size: 0.7rem;
		}

		.confidence {
			font-size: 0.65rem;
		}

	@media (max-width: 480px) {
		.settings-box {
			padding: 0.375rem;
			gap: 0.375rem;
		}
		
		.rule-label {
			font-size: 0.75rem;
		}
		
		.rule-select {
			padding: 0.375rem 0.5rem;
			font-size: 0.7rem;
			min-width: 120px;
		}
	}
</style>