<script lang="ts">
	import { Palette, ChevronDown, Pipette } from 'lucide-svelte';
	import type { ScreenshotConfig } from '$lib/tools/screenshot/types/config';
	import { i18n } from '$lib/tools/screenshot/i18n';

	interface Props {
		config: ScreenshotConfig;
		onConfigChange: (config: ScreenshotConfig) => void;
	}

	let { config, onConfigChange }: Props = $props();
	let isCollapsed = $state(true);
	let showCustomGradient = $state(false);
	let gradientColor1 = $state('#667eea');
	let gradientColor2 = $state('#764ba2');
	let gradientDirection = $state('to bottom right');

	function updateConfig<K extends keyof ScreenshotConfig>(key: K, value: ScreenshotConfig[K]) {
		onConfigChange({ ...config, [key]: value });
	}

	function applyCustomGradient() {
		const gradient = `linear-gradient(${gradientDirection}, ${gradientColor1}, ${gradientColor2})`;
		updateConfig('background', gradient);
	}

	const backgrounds = [
		{
			value: 'transparent',
			label: 'Transparent',
			style:
				'background-image: linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%); background-size: 10px 10px; background-position: 0 0, 0 5px, 5px -5px, -5px 0px;'
		},
		{ value: '#ffffff', label: 'White', style: 'background-color: #ffffff;' },
		{ value: '#18181b', label: 'Dark', style: 'background-color: #18181b;' },
		{
			value: 'linear-gradient(to bottom right, #eff6ff, #dbeafe)',
			label: 'Sky Blue',
			style: 'background: linear-gradient(to bottom right, #eff6ff, #dbeafe);'
		},
		{
			value: 'linear-gradient(to bottom right, #faf5ff, #f3e8ff)',
			label: 'Lavender',
			style: 'background: linear-gradient(to bottom right, #faf5ff, #f3e8ff);'
		},
		{
			value: 'linear-gradient(to bottom right, #fef3c7, #fde68a)',
			label: 'Sunset',
			style: 'background: linear-gradient(to bottom right, #fef3c7, #fde68a);'
		},
		{
			value: 'linear-gradient(to bottom right, #dcfce7, #bbf7d0)',
			label: 'Mint',
			style: 'background: linear-gradient(to bottom right, #dcfce7, #bbf7d0);'
		},
		{
			value: 'linear-gradient(to bottom right, #fee2e2, #fecaca)',
			label: 'Rose',
			style: 'background: linear-gradient(to bottom right, #fee2e2, #fecaca);'
		},
		{
			value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
			label: 'Purple Blue',
			style: 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);'
		},
		{
			value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
			label: 'Pink Red',
			style: 'background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);'
		}
	];

	const gradientDirections = [
		{ value: 'to bottom', label: '↓' },
		{ value: 'to top', label: '↑' },
		{ value: 'to right', label: '→' },
		{ value: 'to left', label: '←' },
		{ value: 'to bottom right', label: '↘' },
		{ value: 'to bottom left', label: '↙' },
		{ value: 'to top right', label: '↗' },
		{ value: 'to top left', label: '↖' }
	];
</script>

<div class="border rounded-xl bg-card shadow-sm overflow-hidden">
	<!-- Header - Collapsible on mobile -->
	<button
		onclick={() => (isCollapsed = !isCollapsed)}
		class="w-full p-4 lg:p-6 flex items-center justify-between gap-2 hover:bg-secondary/30 transition-colors touch-manipulation lg:cursor-default"
	>
		<div class="flex items-center gap-2">
			<Palette class="size-5" />
			<h2 class="text-lg lg:text-xl font-semibold">{i18n.t('appearance')}</h2>
		</div>
		<ChevronDown
			class="size-5 transition-transform duration-200 lg:hidden {isCollapsed ? '' : 'rotate-180'}"
		/>
	</button>

	<!-- Content -->
	<div class="px-4 pb-4 lg:px-6 lg:pb-6 {isCollapsed ? 'hidden lg:block' : ''}">
		<div class="space-y-6">
			<!-- Background Selection -->
			<div>
				<div class="flex items-center justify-between mb-3">
					<span class="text-sm font-medium">{i18n.t('background')}</span>
					<button
						onclick={() => (showCustomGradient = !showCustomGradient)}
						class="flex items-center gap-1 text-xs text-primary hover:underline"
					>
						<Pipette class="size-3" />
						{showCustomGradient ? i18n.t('hide') : i18n.t('custom')}
					</button>
				</div>
				<div class="grid grid-cols-5 gap-2">
					{#each backgrounds as bg}
						<button
							class="h-12 lg:h-10 rounded-xl lg:rounded-lg border flex items-center justify-center transition-all touch-manipulation active:scale-95 {config.background ===
							bg.value
								? 'ring-2 ring-primary ring-offset-2'
								: 'hover:scale-105'}"
							style={bg.style}
							onclick={() => updateConfig('background', bg.value)}
							title={bg.label}
						></button>
					{/each}
				</div>
			</div>

			<!-- Custom Gradient -->
			{#if showCustomGradient}
				<div class="p-4 bg-secondary/30 rounded-lg space-y-4">
					<span class="text-sm font-medium">{i18n.t('customGradient')}</span>

					<div class="grid grid-cols-2 gap-4">
						<label class="block">
							<span class="text-xs text-muted-foreground mb-1 block">{i18n.t('color1')}</span>
							<div class="flex gap-2">
								<input
									type="color"
									bind:value={gradientColor1}
									class="w-10 h-10 rounded cursor-pointer border-0"
								/>
								<input
									type="text"
									bind:value={gradientColor1}
									class="flex-1 px-2 py-1 text-xs border rounded bg-background"
								/>
							</div>
						</label>
						<label class="block">
							<span class="text-xs text-muted-foreground mb-1 block">{i18n.t('color2')}</span>
							<div class="flex gap-2">
								<input
									type="color"
									bind:value={gradientColor2}
									class="w-10 h-10 rounded cursor-pointer border-0"
								/>
								<input
									type="text"
									bind:value={gradientColor2}
									class="flex-1 px-2 py-1 text-xs border rounded bg-background"
								/>
							</div>
						</label>
					</div>

					<div>
						<span class="text-xs text-muted-foreground mb-2 block">{i18n.t('direction')}</span>
						<div class="grid grid-cols-4 gap-1">
							{#each gradientDirections as dir}
								<button
									onclick={() => (gradientDirection = dir.value)}
									class="h-8 text-sm rounded border transition-colors {gradientDirection ===
									dir.value
										? 'bg-primary text-primary-foreground'
										: 'hover:bg-secondary'}"
								>
									{dir.label}
								</button>
							{/each}
						</div>
					</div>

					<div class="flex items-center gap-2">
						<div
							class="flex-1 h-10 rounded border"
							style="background: linear-gradient({gradientDirection}, {gradientColor1}, {gradientColor2});"
						></div>
						<button
							onclick={applyCustomGradient}
							class="px-4 h-10 bg-primary text-primary-foreground rounded font-medium hover:bg-primary/90 transition-colors"
						>
							{i18n.t('apply')}
						</button>
					</div>
				</div>
			{/if}

			<div class="grid grid-cols-2 gap-4">
				<!-- Shadow Intensity -->
				<label class="block">
					<div class="flex justify-between mb-2">
						<span class="text-sm font-medium">{i18n.t('shadow')}</span>
						<span class="text-xs text-muted-foreground">{config.shadow}%</span>
					</div>
					<input
						type="range"
						value={config.shadow}
						oninput={(e) => updateConfig('shadow', parseInt(e.currentTarget.value))}
						min="0"
						max="100"
						step="10"
						class="w-full accent-black h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer touch-manipulation"
					/>
				</label>

				<!-- Padding -->
				<label class="block">
					<div class="flex justify-between mb-2">
						<span class="text-sm font-medium">{i18n.t('padding')}</span>
						<span class="text-xs text-muted-foreground">{config.padding}px</span>
					</div>
					<input
						type="range"
						value={config.padding}
						oninput={(e) => updateConfig('padding', parseInt(e.currentTarget.value))}
						min="0"
						max="100"
						step="10"
						class="w-full accent-black h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer touch-manipulation"
					/>
				</label>
			</div>
		</div>
	</div>
</div>
