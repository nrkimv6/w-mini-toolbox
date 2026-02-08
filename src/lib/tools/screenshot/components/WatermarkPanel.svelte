<script lang="ts">
	import { Image, ChevronDown, X } from 'lucide-svelte';
	import type { ScreenshotConfig, WatermarkPosition } from '$lib/tools/screenshot/types/config';
	import { i18n } from '$lib/tools/screenshot/i18n';

	interface Props {
		config: ScreenshotConfig;
		onConfigChange: (config: ScreenshotConfig) => void;
	}

	let { config, onConfigChange }: Props = $props();
	let isCollapsed = $state(true);
	let fileInput: HTMLInputElement;

	function updateConfig<K extends keyof ScreenshotConfig>(key: K, value: ScreenshotConfig[K]) {
		onConfigChange({ ...config, [key]: value });
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (event) => {
				const dataUrl = event.target?.result as string;
				updateConfig('watermarkImage', dataUrl);
			};
			reader.readAsDataURL(file);
		}
	}

	function clearWatermark() {
		updateConfig('watermarkImage', '');
		if (fileInput) {
			fileInput.value = '';
		}
	}

	function getPositionLabel(pos: WatermarkPosition): string {
		const labels: Record<WatermarkPosition, () => string> = {
			'top-left': () => i18n.t('topLeft'),
			'top-right': () => i18n.t('topRight'),
			'bottom-left': () => i18n.t('bottomLeft'),
			'bottom-right': () => i18n.t('bottomRight')
		};
		return labels[pos]();
	}
</script>

<div class="border rounded-xl bg-card shadow-sm overflow-hidden">
	<!-- Header - Collapsible on mobile -->
	<button
		onclick={() => (isCollapsed = !isCollapsed)}
		class="w-full p-4 lg:p-6 flex items-center justify-between gap-2 hover:bg-secondary/30 transition-colors touch-manipulation lg:cursor-default"
	>
		<div class="flex items-center gap-2">
			<Image class="size-5" />
			<h2 class="text-lg lg:text-xl font-semibold">{i18n.t('watermark')}</h2>
		</div>
		<ChevronDown
			class="size-5 transition-transform duration-200 lg:hidden {isCollapsed ? '' : 'rotate-180'}"
		/>
	</button>

	<!-- Content -->
	<div class="px-4 pb-4 lg:px-6 lg:pb-6 {isCollapsed ? 'hidden lg:block' : ''}">
		<div class="space-y-4">
			<!-- Logo Upload -->
			<div class="block">
				<span class="text-sm font-medium">{i18n.t('logoImage')}</span>
				<div class="mt-2">
					{#if config.watermarkImage}
						<div class="flex items-center gap-3">
							<div class="relative w-16 h-16 border rounded-lg overflow-hidden bg-gray-100">
								<img
									src={config.watermarkImage}
									alt="Watermark preview"
									class="w-full h-full object-contain"
								/>
							</div>
							<button
								onclick={clearWatermark}
								class="flex items-center gap-1.5 px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors touch-manipulation"
							>
								<X class="size-4" />
								{i18n.t('removeWatermark')}
							</button>
						</div>
					{:else}
						<label
							class="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-secondary/30 transition-colors"
						>
							<Image class="size-6 text-gray-400 mb-1" />
							<span class="text-sm text-gray-500">{i18n.t('clickToUploadLogo')}</span>
							<span class="text-xs text-gray-400">PNG, JPG, SVG</span>
							<input
								bind:this={fileInput}
								type="file"
								accept="image/*"
								onchange={handleFileSelect}
								class="hidden"
							/>
						</label>
					{/if}
				</div>
			</div>

			{#if config.watermarkImage}
				<!-- Position -->
				<label class="block">
					<span class="text-sm font-medium">{i18n.t('watermarkPosition')}</span>
					<div class="grid grid-cols-2 gap-2 mt-2">
						{#each ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as pos}
							<button
								class="px-3 py-2 text-sm border rounded-lg transition-colors touch-manipulation {config.watermarkPosition ===
								pos
									? 'bg-primary text-primary-foreground border-primary'
									: 'hover:bg-secondary'}"
								onclick={() => updateConfig('watermarkPosition', pos as WatermarkPosition)}
							>
								{getPositionLabel(pos as WatermarkPosition)}
							</button>
						{/each}
					</div>
				</label>

				<!-- Size -->
				<label class="block">
					<span class="text-sm font-medium">{i18n.t('watermarkSize')}</span>
					<div class="flex items-center gap-2 mt-1">
						<input
							type="range"
							value={config.watermarkSize}
							oninput={(e) => updateConfig('watermarkSize', parseInt(e.currentTarget.value))}
							min="20"
							max="150"
							class="flex-1 touch-manipulation"
						/>
						<span class="text-sm w-12 text-right">{config.watermarkSize}px</span>
					</div>
				</label>

				<!-- Opacity -->
				<label class="block">
					<span class="text-sm font-medium">{i18n.t('watermarkOpacity')}</span>
					<div class="flex items-center gap-2 mt-1">
						<input
							type="range"
							value={config.watermarkOpacity}
							oninput={(e) => updateConfig('watermarkOpacity', parseInt(e.currentTarget.value))}
							min="10"
							max="100"
							class="flex-1 touch-manipulation"
						/>
						<span class="text-sm w-12 text-right">{config.watermarkOpacity}%</span>
					</div>
				</label>
			{/if}
		</div>
	</div>
</div>
