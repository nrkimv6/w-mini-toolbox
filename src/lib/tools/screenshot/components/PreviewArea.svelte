<script lang="ts">
	import { Smartphone } from 'lucide-svelte';
	import MobilePreview from './MobilePreview.svelte';
	import type { ScreenshotConfig, ScreenshotData } from '$lib/tools/screenshot/types/config';
	import { i18n } from '$lib/tools/screenshot/i18n';

	interface Props {
		images: ScreenshotData[];
		config: ScreenshotConfig;
		mockupElements: Record<string, HTMLElement>;
		onDownloadSingle: (id: string) => void;
	}

	let { images, config, mockupElements = $bindable(), onDownloadSingle }: Props = $props();

	function getWatermarkPositionStyles(position: string): string {
		switch (position) {
			case 'top-left':
				return 'top: 8px; left: 8px;';
			case 'top-right':
				return 'top: 8px; right: 8px;';
			case 'bottom-left':
				return 'bottom: 8px; left: 8px;';
			case 'bottom-right':
			default:
				return 'bottom: 8px; right: 8px;';
		}
	}
</script>

<div
	class="lg:sticky lg:top-8 flex flex-col items-center bg-secondary/30 rounded-2xl lg:rounded-3xl p-4 lg:p-12 min-h-[300px] lg:min-h-[600px] border-2 border-dashed border-gray-200 overflow-hidden order-1 lg:order-2"
>
	{#if images.length === 0}
		<div
			class="flex flex-col items-center justify-center h-full text-muted-foreground mt-12 lg:mt-32"
		>
			<div class="p-4 bg-white rounded-full shadow-sm mb-4">
				<Smartphone class="size-8 text-gray-400" />
			</div>
			<p class="font-medium">{i18n.t('noImagesSelected')}</p>
			<p class="text-sm">{i18n.t('uploadToGenerate')}</p>
		</div>
	{:else}
		<div class="w-full space-y-12">
			{#each images as img (img.id)}
				<div class="w-full flex flex-col items-center gap-4">
					<div
						bind:this={mockupElements[img.id]}
						class="relative transform scale-100 origin-top flex flex-col items-center justify-center transition-all duration-300 ease-in-out shadow-sm"
						style:background={config.background}
						style:padding={`${config.padding}px`}
					>
						{#if config.overlayText && config.overlayPosition === 'top'}
							<div
								class="text-center font-semibold mb-4 px-4"
								style:font-size={`${config.overlaySize}px`}
								style:color={config.overlayColor}
								style:text-shadow={config.overlayColor === '#ffffff'
									? '0 1px 3px rgba(0,0,0,0.3)'
									: '0 1px 3px rgba(255,255,255,0.3)'}
							>
								{config.overlayText}
							</div>
						{/if}
						<MobilePreview image={img.url} {config} />
						{#if config.overlayText && config.overlayPosition === 'bottom'}
							<div
								class="text-center font-semibold mt-4 px-4"
								style:font-size={`${config.overlaySize}px`}
								style:color={config.overlayColor}
								style:text-shadow={config.overlayColor === '#ffffff'
									? '0 1px 3px rgba(0,0,0,0.3)'
									: '0 1px 3px rgba(255,255,255,0.3)'}
							>
								{config.overlayText}
							</div>
						{/if}
						<!-- Watermark -->
						{#if config.watermarkImage}
							<img
								src={config.watermarkImage}
								alt="Watermark"
								class="absolute pointer-events-none"
								style="{getWatermarkPositionStyles(config.watermarkPosition)} width: {config.watermarkSize}px; height: auto; opacity: {config.watermarkOpacity / 100};"
							/>
						{/if}
					</div>
					{#if images.length > 1}
						<button
							onclick={() => onDownloadSingle(img.id)}
							class="text-sm border px-3 py-1 rounded-full bg-white hover:bg-gray-50 transition-colors shadow-sm"
						>
							{i18n.t('downloadThisOne')}
						</button>
					{/if}
				</div>
				{#if images.length > 1 && img !== images[images.length - 1]}
					<div class="w-full h-px bg-border/50"></div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
