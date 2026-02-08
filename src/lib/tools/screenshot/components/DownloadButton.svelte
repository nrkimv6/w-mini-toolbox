<script lang="ts">
	import { Download, Loader2, X } from 'lucide-svelte';
	import { i18n } from '$lib/tools/screenshot/i18n';

	interface Props {
		imageCount: number;
		isGenerating: boolean;
		generationProgress: number;
		generationTotal: number;
		onDownload: () => void;
		onCancel?: () => void;
	}

	let { imageCount, isGenerating, generationProgress, generationTotal, onDownload, onCancel }: Props =
		$props();
</script>

<div class="grid grid-cols-1 gap-4">
	{#if isGenerating && generationTotal > 1}
		<!-- Progress state with cancel button -->
		<div class="flex gap-2">
			<div class="relative flex-1 bg-black text-white py-4 rounded-xl flex items-center justify-center gap-2 font-medium overflow-hidden">
				<!-- Progress bar background -->
				<div
					class="absolute inset-0 bg-green-600 transition-all duration-300"
					style:width={`${(generationProgress / generationTotal) * 100}%`}
				></div>
				<span class="relative z-10 flex items-center gap-2">
					<Loader2 class="size-5 animate-spin" />
					{generationProgress} / {generationTotal}
				</span>
			</div>
			<button
				onclick={onCancel}
				class="px-4 py-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors flex items-center gap-2"
			>
				<X class="size-5" />
				{i18n.t('cancel')}
			</button>
		</div>
	{:else}
		<button
			onclick={onDownload}
			disabled={imageCount === 0 || isGenerating}
			class="relative w-full bg-black text-white py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium hover:bg-gray-900 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 overflow-hidden"
		>
			{#if isGenerating}
				<Loader2 class="size-5 animate-spin" /> {i18n.t('generating')}
			{:else}
				<Download class="size-5" />
				{imageCount > 1 ? `${i18n.t('downloadAll')} (${imageCount})` : i18n.t('downloadMockup')}
			{/if}
		</button>
	{/if}
</div>
