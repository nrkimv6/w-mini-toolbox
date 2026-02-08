<script lang="ts">
	import ImageUploader from '$lib/tools/screenshot/components/ImageUploader.svelte';
	import ConfigPanel from '$lib/tools/screenshot/components/ConfigPanel.svelte';
	import AppearancePanel from '$lib/tools/screenshot/components/AppearancePanel.svelte';
	import TextOverlayPanel from '$lib/tools/screenshot/components/TextOverlayPanel.svelte';
	import WatermarkPanel from '$lib/tools/screenshot/components/WatermarkPanel.svelte';
	import PreviewArea from '$lib/tools/screenshot/components/PreviewArea.svelte';
	import DownloadButton from '$lib/tools/screenshot/components/DownloadButton.svelte';
	import HistoryPanel from '$lib/tools/screenshot/components/HistoryPanel.svelte';
	import { defaultConfig, type ScreenshotConfig, type ScreenshotData } from '$lib/tools/screenshot/types/config';
	import { toast } from '$lib/tools/screenshot/stores/toast';
	import { imageHistory } from '$lib/tools/screenshot/stores/imageHistory';
	import { i18n } from '$lib/tools/screenshot/i18n';
	import JSZip from 'jszip';

	let images = $state<ScreenshotData[]>([]);
	let config = $state<ScreenshotConfig>({ ...defaultConfig });
	let isGenerating = $state(false);
	let generationProgress = $state(0);
	let generationTotal = $state(0);
	let mockupElements: Record<string, HTMLElement> = $state({});
	let abortController: AbortController | null = null;
	let historyPanel: HistoryPanel;

	function handleImagesChange(newImages: ScreenshotData[]) {
		images = newImages;
	}

	function handleConfigChange(newConfig: ScreenshotConfig) {
		config = newConfig;
	}

	async function handleDownloadAll() {
		if (images.length === 0) return;

		// Dynamic import for html2canvas (SSR safety)
		const { default: html2canvas } = await import('html2canvas');

		abortController = new AbortController();
		isGenerating = true;
		generationProgress = 0;
		generationTotal = images.length;
		const zip = new JSZip();

		try {
			for (let i = 0; i < images.length; i++) {
				// Check if cancelled
				if (abortController.signal.aborted) {
					toast.info(i18n.t('generationCancelled'));
					return;
				}

				const img = images[i];
				const el = mockupElements[img.id];
				if (!el) continue;

				const canvas = await html2canvas(el, {
					backgroundColor: null,
					scale: config.exportScale,
					useCORS: true,
					logging: false
				});

				// Check again after async operation
				if (abortController.signal.aborted) {
					toast.info(i18n.t('generationCancelled'));
					return;
				}

				const blob = await new Promise<Blob | null>((resolve) =>
					canvas.toBlob(resolve, 'image/png')
				);
				if (blob) {
					const name =
						img.file.name.replace(/\.[^/.]+$/, '') + `-mockup-${config.frameType}.png`;
					zip.file(name, blob);

					// Save to history
					const dataUrl = canvas.toDataURL('image/png');
					historyPanel?.addToHistory(dataUrl, name);
				} else {
					console.error('Failed to convert canvas to blob:', img.file.name);
					toast.error(`이미지 변환 실패: ${img.file.name}`);
				}

				generationProgress = i + 1;
			}

			// Final check before download
			if (abortController.signal.aborted) {
				toast.info(i18n.t('generationCancelled'));
				return;
			}

			const content = await zip.generateAsync({ type: 'blob' });
			const link = document.createElement('a');
			const url = URL.createObjectURL(content);
			link.href = url;
			link.download = `mockups-${Date.now()}.zip`;
			link.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			console.error('Batch generation failed', e);
			toast.error(i18n.t('generationFailed'));
		} finally {
			isGenerating = false;
			generationProgress = 0;
			generationTotal = 0;
			abortController = null;
		}
	}

	function handleCancelGeneration() {
		if (abortController) {
			abortController.abort();
		}
	}

	async function handleDownloadSingle(id: string) {
		const img = images.find((i) => i.id === id);
		const el = mockupElements[id];
		if (!img || !el) return;

		// Dynamic import for html2canvas (SSR safety)
		const { default: html2canvas } = await import('html2canvas');

		try {
			const canvas = await html2canvas(el, {
				backgroundColor: null,
				scale: config.exportScale,
				useCORS: true,
				logging: false
			});

			const fileName = `${img.file.name.replace(/\.[^/.]+$/, '')}-mockup-${config.frameType}.png`;
			const dataUrl = canvas.toDataURL('image/png');

			// Save to history
			historyPanel?.addToHistory(dataUrl, fileName);

			// Download
			const link = document.createElement('a');
			link.download = fileName;
			link.href = dataUrl;
			link.click();
		} catch (e) {
			console.error(e);
			toast.error(i18n.t('generationFailed'));
		}
	}
</script>

<div class="min-h-screen bg-background pb-20">
	<div class="mx-auto max-w-7xl px-4 py-8">
		<!-- Header -->
		<div class="mb-6 lg:mb-12 text-center">
			<h1 class="text-2xl lg:text-4xl font-bold tracking-tight mb-2 lg:mb-3">
				{i18n.t('title')}
			</h1>
			<p class="text-sm lg:text-lg text-muted-foreground">
				{i18n.t('subtitle')}
			</p>
		</div>

		<div class="grid gap-8 lg:gap-12 lg:grid-cols-2 items-start">
			<!-- Controls -->
			<div class="space-y-6 lg:space-y-8 order-2 lg:order-1">
				<ImageUploader {images} onImagesChange={handleImagesChange} />
				<ConfigPanel {config} onConfigChange={handleConfigChange} />
				<AppearancePanel {config} onConfigChange={handleConfigChange} />
				<TextOverlayPanel {config} onConfigChange={handleConfigChange} />
				<WatermarkPanel {config} onConfigChange={handleConfigChange} />
				<DownloadButton
					imageCount={images.length}
					{isGenerating}
					{generationProgress}
					{generationTotal}
					onDownload={handleDownloadAll}
					onCancel={handleCancelGeneration}
				/>
				<HistoryPanel bind:this={historyPanel} />
			</div>

			<!-- Preview Area -->
			<PreviewArea
				{images}
				{config}
				bind:mockupElements
				onDownloadSingle={handleDownloadSingle}
			/>
		</div>
	</div>
</div>
