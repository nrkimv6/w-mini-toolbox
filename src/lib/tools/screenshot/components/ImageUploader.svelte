<script lang="ts">
	import { Upload, Trash2 } from 'lucide-svelte';
	import type { ScreenshotData } from '$lib/tools/screenshot/types/config';
	import { i18n } from '$lib/tools/screenshot/i18n';

	interface Props {
		images: ScreenshotData[];
		onImagesChange: (images: ScreenshotData[]) => void;
	}

	let { images, onImagesChange }: Props = $props();

	let fileInput: HTMLInputElement;
	let isDragging = $state(false);

	async function processFiles(files: FileList | File[]) {
		const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));

		try {
			const newImages = await Promise.all(
				fileArray.map(
					(file) =>
						new Promise<ScreenshotData>((resolve, reject) => {
							const reader = new FileReader();
							reader.onload = (event) => {
								if (event.target?.result) {
									resolve({
										id: crypto.randomUUID(),
										url: event.target.result as string,
										file
									});
								} else {
									reject(new Error('Failed to read file'));
								}
							};
							reader.onerror = () => reject(new Error('FileReader error'));
							reader.readAsDataURL(file);
						})
				)
			);

			onImagesChange([...images, ...newImages]);
		} catch (error) {
			console.error('Failed to process images:', error);
		}
	}

	function handleImageUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files) {
			processFiles(target.files);
		}
		target.value = '';
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files) {
			processFiles(e.dataTransfer.files);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	function removeImage(id: string) {
		onImagesChange(images.filter((img) => img.id !== id));
	}

	function clearAll() {
		onImagesChange([]);
	}
</script>

<div class="p-4 lg:p-8 border rounded-xl bg-card shadow-sm transition-all hover:shadow-md">
	<div class="flex items-center justify-between mb-6">
		<h2 class="text-xl font-semibold flex items-center gap-2">
			<Upload class="size-5" /> {i18n.t('uploadTitle')}
		</h2>
		{#if images.length > 0}
			<button
				onclick={clearAll}
				class="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
			>
				{i18n.t('clearAll')}
			</button>
		{/if}
	</div>

	<div
		class="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors {isDragging
			? 'border-primary bg-primary/10'
			: 'border-muted-foreground/25 hover:bg-secondary/50'}"
		onclick={() => fileInput.click()}
		onkeydown={(e) => e.key === 'Enter' && fileInput.click()}
		ondrop={handleDrop}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		role="button"
		tabindex="0"
	>
		<div
			class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors {isDragging
				? 'bg-primary/20'
				: 'bg-secondary/50'}"
		>
			<Upload
				class="size-8 transition-colors {isDragging ? 'text-primary' : 'text-muted-foreground'}"
			/>
		</div>
		<p class="font-medium">
			{isDragging ? i18n.t('dropHere') : i18n.t('dragOrClick')}
		</p>
		<p class="text-sm text-muted-foreground mt-1">{i18n.t('supportedFormats')}</p>
	</div>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		multiple
		class="hidden"
		onchange={handleImageUpload}
	/>

	{#if images.length > 0}
		<div class="mt-6 space-y-2">
			<div class="text-sm font-medium text-muted-foreground mb-2">
				{i18n.t('selectedImages')} ({images.length})
			</div>
			<div class="max-h-[200px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
				{#each images as img (img.id)}
					<div
						class="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border/50"
					>
						<div class="flex items-center gap-3 overflow-hidden">
							<img
								src={img.url}
								alt="thumbnail"
								class="w-10 h-10 object-cover rounded-md bg-white border"
							/>
							<span class="text-sm truncate max-w-[180px]">{img.file.name}</span>
						</div>
						<button
							onclick={() => removeImage(img.id)}
							class="p-1.5 hover:bg-red-100 text-muted-foreground hover:text-red-500 rounded-md transition-colors"
						>
							<Trash2 class="size-4" />
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
