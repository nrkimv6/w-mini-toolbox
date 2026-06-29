<script lang="ts">
	import { History, Trash2, Download, X, Cloud } from 'lucide-svelte';
	import { imageHistory, type SavedImage } from '$lib/tools/screenshot/stores/imageHistory';
	import { onMount } from 'svelte';
	import { i18n } from '$lib/tools/screenshot/i18n';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import { env } from '$env/dynamic/public';
	import { toast } from '$lib/tools/screenshot/stores/toast';

	let history = $state<SavedImage[]>([]);
	let expanded = $state(false);
	let showClearDialog = $state(false);
	let exportingId = $state<string | null>(null);
	let exportedUrls = $state<Record<string, string>>({});

	const gcsEnabled = env.PUBLIC_ENABLE_GCS_EXPORT === 'true';

	onMount(() => {
		history = imageHistory.getHistory();
	});

	function refreshHistory() {
		history = imageHistory.getHistory();
	}

	function deleteImage(id: string) {
		imageHistory.deleteImage(id);
		refreshHistory();
	}

	async function handleCloudExport(item: SavedImage) {
		if (!confirm('이 이미지를 Cloud Storage에 업로드하시겠습니까?')) return;

		exportingId = item.id;
		try {
			const url = await imageHistory.exportToGCS(item.thumbnail, item.fileName);
			if (url) {
				exportedUrls = { ...exportedUrls, [item.id]: url };
			} else {
				toast.error('Cloud Export에 실패했습니다.');
			}
		} finally {
			exportingId = null;
		}
	}

	function copyUrl(url: string) {
		navigator.clipboard.writeText(url).then(() => {
			toast.success('URL이 클립보드에 복사되었습니다.');
		});
	}

	function clearAll() {
		showClearDialog = true;
	}

	function confirmClearAll() {
		imageHistory.clearHistory();
		refreshHistory();
	}

	function formatDate(isoString: string): string {
		const date = new Date(isoString);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (i18n.locale === 'ko') {
			if (minutes < 1) return '방금 전';
			if (minutes < 60) return `${minutes}분 전`;
			if (hours < 24) return `${hours}시간 전`;
			if (days < 7) return `${days}일 전`;
			return date.toLocaleDateString('ko-KR');
		} else {
			if (minutes < 1) return 'Just now';
			if (minutes < 60) return `${minutes}m ago`;
			if (hours < 24) return `${hours}h ago`;
			if (days < 7) return `${days}d ago`;
			return date.toLocaleDateString('en-US');
		}
	}

	// Export function for parent to call
	export function addToHistory(dataUrl: string, fileName: string) {
		imageHistory.addImage(dataUrl, fileName).then(() => {
			refreshHistory();
		});
	}
</script>

<div class="rounded-xl bg-card border border-border overflow-hidden">
	<button
		onclick={() => (expanded = !expanded)}
		class="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
	>
		<div class="flex items-center gap-2">
			<History class="w-5 h-5 text-muted-foreground" />
			<span class="font-medium">{i18n.t('recentHistory')}</span>
			{#if history.length > 0}
				<span class="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
					{history.length}
				</span>
			{/if}
		</div>
		<span class="text-muted-foreground text-sm">
			{expanded ? i18n.t('collapse') : i18n.t('expand')}
		</span>
	</button>

	{#if expanded}
		<div class="border-t border-border">
			{#if history.length === 0}
				<div class="p-6 text-center text-muted-foreground">
					<History class="w-8 h-8 mx-auto mb-2 opacity-50" />
					<p class="text-sm">{i18n.t('noHistory')}</p>
				</div>
			{:else}
				<div class="p-3 flex justify-end">
					<button
						onclick={clearAll}
						class="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
					>
						<Trash2 class="w-3 h-3" />
						{i18n.t('clearAll')}
					</button>
				</div>
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 p-3 pt-0">
					{#each history as item}
						<div class="group relative rounded-lg overflow-hidden bg-muted/30 border border-border hover:border-primary/50 transition-colors">
							<div class="aspect-[9/16] overflow-hidden">
								<img
									src={item.thumbnail}
									alt={item.fileName}
									class="w-full h-full object-cover"
								/>
							</div>
							<div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
								<a
									href={item.thumbnail}
									download={item.fileName}
									class="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
									title={i18n.t('download')}
								>
									<Download class="w-4 h-4 text-white" />
								</a>
								{#if gcsEnabled}
									<button
										onclick={() => handleCloudExport(item)}
										disabled={exportingId === item.id}
										class="p-2 bg-white/20 rounded-full hover:bg-blue-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
										title="Cloud Export"
									>
										<Cloud class="w-4 h-4 text-white" />
									</button>
								{/if}
								<button
									onclick={() => deleteImage(item.id)}
									class="p-2 bg-white/20 rounded-full hover:bg-red-500/50 transition-colors"
									title={i18n.t('delete')}
								>
									<X class="w-4 h-4 text-white" />
								</button>
							</div>
							<div class="p-2 text-xs">
								<p class="truncate text-muted-foreground">{item.fileName}</p>
								<p class="text-muted-foreground/60">{formatDate(item.createdAt)}</p>
								{#if exportedUrls[item.id]}
									<button
										onclick={() => copyUrl(exportedUrls[item.id])}
										class="mt-1 w-full text-left truncate text-blue-500 hover:text-blue-400 flex items-center gap-1"
										title={exportedUrls[item.id]}
									>
										<Cloud class="w-3 h-3 shrink-0" />
										<span class="truncate">URL 복사</span>
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<ConfirmDialog
	bind:open={showClearDialog}
	title={i18n.t('clearAll')}
	message={i18n.t('confirmClearHistory')}
	confirmText={i18n.t('clear')}
	cancelText={i18n.t('cancel')}
	onConfirm={confirmClearAll}
	onCancel={() => {}}
/>
