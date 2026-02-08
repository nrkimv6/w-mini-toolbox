<script lang="ts">
	import { Type, ChevronDown } from 'lucide-svelte';
	import type { ScreenshotConfig, OverlayPosition } from '$lib/tools/screenshot/types/config';
	import { i18n } from '$lib/tools/screenshot/i18n';

	interface Props {
		config: ScreenshotConfig;
		onConfigChange: (config: ScreenshotConfig) => void;
	}

	let { config, onConfigChange }: Props = $props();
	let isCollapsed = $state(true);

	function updateConfig<K extends keyof ScreenshotConfig>(key: K, value: ScreenshotConfig[K]) {
		onConfigChange({ ...config, [key]: value });
	}
</script>

<div class="border rounded-xl bg-card shadow-sm overflow-hidden">
	<!-- Header - Collapsible on mobile -->
	<button
		onclick={() => (isCollapsed = !isCollapsed)}
		class="w-full p-4 lg:p-6 flex items-center justify-between gap-2 hover:bg-secondary/30 transition-colors touch-manipulation lg:cursor-default"
	>
		<div class="flex items-center gap-2">
			<Type class="size-5" />
			<h2 class="text-lg lg:text-xl font-semibold">{i18n.t('textOverlay')}</h2>
		</div>
		<ChevronDown
			class="size-5 transition-transform duration-200 lg:hidden {isCollapsed ? '' : 'rotate-180'}"
		/>
	</button>

	<!-- Content -->
	<div class="px-4 pb-4 lg:px-6 lg:pb-6 {isCollapsed ? 'hidden lg:block' : ''}">
		<div class="space-y-4">
			<!-- Text Input -->
			<label class="block">
				<span class="text-sm font-medium">{i18n.t('captionText')}</span>
				<input
					type="text"
					value={config.overlayText}
					oninput={(e) => updateConfig('overlayText', e.currentTarget.value)}
					placeholder={i18n.t('textPlaceholder')}
					class="mt-1 block w-full border border-input rounded-lg p-3 bg-background text-base touch-manipulation"
				/>
			</label>

			<!-- Position & Size -->
			<div class="grid grid-cols-2 gap-4">
				<label class="block">
					<span class="text-sm font-medium">{i18n.t('textPosition')}</span>
					<select
						value={config.overlayPosition}
						onchange={(e) =>
							updateConfig('overlayPosition', e.currentTarget.value as OverlayPosition)}
						class="mt-1 block w-full border border-input rounded-lg p-3 bg-background text-base touch-manipulation"
					>
						<option value="top">{i18n.t('top')}</option>
						<option value="bottom">{i18n.t('bottom')}</option>
					</select>
				</label>
				<label class="block">
					<span class="text-sm font-medium">{i18n.t('textSize')}</span>
					<div class="flex items-center gap-2 mt-1">
						<input
							type="range"
							value={config.overlaySize}
							oninput={(e) => updateConfig('overlaySize', parseInt(e.currentTarget.value))}
							min="12"
							max="48"
							class="flex-1 touch-manipulation"
						/>
						<span class="text-sm w-10 text-right">{config.overlaySize}px</span>
					</div>
				</label>
			</div>

			<!-- Color -->
			<label class="block">
				<span class="text-sm font-medium">{i18n.t('textColor')}</span>
				<div class="flex items-center gap-3 mt-1">
					<input
						type="color"
						value={config.overlayColor}
						oninput={(e) => updateConfig('overlayColor', e.currentTarget.value)}
						class="w-12 h-12 border border-input rounded-lg cursor-pointer touch-manipulation"
					/>
					<div class="flex gap-2">
						<button
							class="px-4 py-2.5 border rounded-lg text-sm hover:bg-secondary transition-colors touch-manipulation active:scale-95 {config.overlayColor ===
							'#ffffff'
								? 'ring-2 ring-primary'
								: ''}"
							onclick={() => updateConfig('overlayColor', '#ffffff')}
						>
							{i18n.t('white')}
						</button>
						<button
							class="px-4 py-2.5 border rounded-lg text-sm hover:bg-secondary transition-colors touch-manipulation active:scale-95 {config.overlayColor ===
							'#000000'
								? 'ring-2 ring-primary'
								: ''}"
							onclick={() => updateConfig('overlayColor', '#000000')}
						>
							{i18n.t('black')}
						</button>
					</div>
				</div>
			</label>
		</div>
	</div>
</div>
