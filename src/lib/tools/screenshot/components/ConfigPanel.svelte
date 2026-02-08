<script lang="ts">
	import { LayoutTemplate, Smartphone, Save, History, Trash2, X, ChevronDown } from 'lucide-svelte';
	import { configHistory, type SavedConfig } from '$lib/tools/screenshot/stores/configHistory';
	import type { ScreenshotConfig } from '$lib/tools/screenshot/types/config';
	import { i18n } from '$lib/tools/screenshot/i18n';
	import InputDialog from './InputDialog.svelte';

	interface Props {
		config: ScreenshotConfig;
		onConfigChange: (config: ScreenshotConfig) => void;
	}

	let { config, onConfigChange }: Props = $props();

	let showHistoryPanel = $state(false);
	let showSaveDialog = $state(false);
	let savedConfigs = $state<SavedConfig[]>([]);
	let isCollapsed = $state(false);

	function loadSavedConfigs() {
		savedConfigs = configHistory.getHistory();
	}

	function saveCurrentConfig() {
		showSaveDialog = true;
	}

	function handleSaveConfig(name: string) {
		configHistory.saveConfig(name, config);
		loadSavedConfigs();
	}

	function loadConfig(saved: SavedConfig) {
		onConfigChange({ ...saved.config } as ScreenshotConfig);
		showHistoryPanel = false;
	}

	function deleteConfig(id: string) {
		configHistory.deleteConfig(id);
		loadSavedConfigs();
	}

	function updateConfig<K extends keyof ScreenshotConfig>(key: K, value: ScreenshotConfig[K]) {
		onConfigChange({ ...config, [key]: value });
	}

	function applyPreset(preset: string) {
		if (preset === 'skt-modern') {
			onConfigChange({ ...config, carrier: 'SKT', networkType: '5G' });
		} else if (preset === 'kt-classis') {
			onConfigChange({ ...config, carrier: 'KT', networkType: 'LTE' });
		} else if (preset === 'lgu-plus') {
			onConfigChange({ ...config, carrier: 'LG U+', networkType: '5G' });
		}
	}

	const frames = [
		{ type: 'iphone-15-pro', label: 'iPhone 15' },
		{ type: 'galaxy-s24', label: 'Galaxy S24' },
		{ type: 'pixel-8', label: 'Pixel 8' },
		{ type: 'iphone-se-3', label: 'iPhone SE' },
		{ type: 'generic', label: 'Generic' }
	] as const;
</script>

<div class="border rounded-xl bg-card shadow-sm overflow-hidden">
	<!-- Header - Collapsible on mobile -->
	<button
		onclick={() => (isCollapsed = !isCollapsed)}
		class="w-full p-4 lg:p-6 flex items-center justify-between gap-2 hover:bg-secondary/30 transition-colors touch-manipulation lg:cursor-default"
	>
		<div class="flex items-center gap-2">
			<LayoutTemplate class="size-5" />
			<h2 class="text-lg lg:text-xl font-semibold">{i18n.t('configuration')}</h2>
		</div>
		<div class="flex items-center gap-2">
			{#if !isCollapsed}
				<div class="flex gap-1" onclick={(e) => e.stopPropagation()}>
					<button
						onclick={saveCurrentConfig}
						class="p-2 border rounded-lg hover:bg-secondary transition-colors touch-manipulation"
						title="Save current config"
					>
						<Save class="size-4" />
					</button>
					<button
						onclick={() => {
							loadSavedConfigs();
							showHistoryPanel = !showHistoryPanel;
						}}
						class="p-2 border rounded-lg hover:bg-secondary transition-colors touch-manipulation {showHistoryPanel
							? 'bg-secondary'
							: ''}"
						title="Load saved config"
					>
						<History class="size-4" />
					</button>
				</div>
			{/if}
			<ChevronDown
				class="size-5 transition-transform duration-200 lg:hidden {isCollapsed ? '' : 'rotate-180'}"
			/>
		</div>
	</button>

	<!-- Content -->
	<div class="px-4 pb-4 lg:px-6 lg:pb-6 {isCollapsed ? 'hidden lg:block' : ''}">
		{#if showHistoryPanel}
			<div class="mb-6 p-4 bg-secondary/50 rounded-lg border">
				<div class="flex items-center justify-between mb-3">
					<span class="text-sm font-medium">{i18n.t('savedConfigurations')}</span>
					<button
						onclick={() => (showHistoryPanel = false)}
						class="p-2 hover:bg-secondary rounded touch-manipulation"
					>
						<X class="size-4" />
					</button>
				</div>
				{#if savedConfigs.length === 0}
					<p class="text-sm text-muted-foreground text-center py-4">
						{i18n.t('noSavedConfigs')}
					</p>
				{:else}
					<div class="space-y-2 max-h-[200px] overflow-y-auto">
						{#each savedConfigs as saved (saved.id)}
							<div class="flex items-center justify-between p-3 bg-background rounded-lg border">
								<button
									onclick={() => loadConfig(saved)}
									class="flex-1 text-left py-1 touch-manipulation"
								>
									<span class="font-medium text-sm">{saved.name}</span>
									<span class="text-xs text-muted-foreground ml-2">
										{saved.config.frameType}
									</span>
								</button>
								<button
									onclick={() => deleteConfig(saved.id)}
									class="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded transition-colors touch-manipulation"
								>
									<Trash2 class="size-4" />
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<div class="space-y-6">
			<!-- Frame Selection -->
			<div>
				<span class="block text-sm font-medium mb-3">{i18n.t('deviceFrame')}</span>
				<div class="grid grid-cols-3 sm:grid-cols-5 gap-2">
					{#each frames as frame}
						<button
							class="p-3 lg:p-4 border rounded-xl flex flex-col items-center gap-2 transition-all touch-manipulation active:scale-95 {config.frameType ===
							frame.type
								? 'border-black bg-black text-white ring-2 ring-offset-2 ring-black'
								: 'hover:bg-secondary active:bg-secondary'}"
							onclick={() => updateConfig('frameType', frame.type)}
						>
							{#if frame.type === 'generic'}
								<div class="size-5 border-2 border-current rounded-md"></div>
							{:else}
								<Smartphone class="size-5" />
							{/if}
							<span class="text-xs font-medium">{frame.label}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Status Bar Info -->
			<div class="grid grid-cols-2 gap-4">
				<label class="block">
					<span class="text-sm font-medium">{i18n.t('time')}</span>
					<input
						type="time"
						value={config.time}
						onchange={(e) => updateConfig('time', e.currentTarget.value)}
						class="mt-1 block w-full border border-input rounded-lg p-3 bg-background text-base touch-manipulation"
					/>
				</label>
				<label class="block">
					<span class="text-sm font-medium">{i18n.t('battery')}</span>
					<div class="flex items-center gap-2 mt-1">
						<input
							type="range"
							value={config.battery}
							oninput={(e) => updateConfig('battery', parseInt(e.currentTarget.value))}
							min="0"
							max="100"
							class="flex-1 h-2 touch-manipulation"
						/>
						<span class="text-sm w-10 text-right">{config.battery}%</span>
					</div>
				</label>
			</div>

			<!-- Carrier Presets -->
			<div>
				<span class="block text-sm font-medium mb-3">{i18n.t('carrierPreset')}</span>
				<div class="flex gap-2 flex-wrap">
					{#each [
						{ id: 'skt-modern', label: 'SKT' },
						{ id: 'kt-classis', label: 'KT' },
						{ id: 'lgu-plus', label: 'LG U+' }
					] as preset}
						<button
							class="px-4 py-2.5 border rounded-lg text-sm hover:bg-secondary transition-colors touch-manipulation active:scale-95 active:bg-secondary"
							onclick={() => applyPreset(preset.id)}
						>
							{preset.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Export Quality -->
			<div>
				<span class="block text-sm font-medium mb-3">{i18n.t('exportQuality')}</span>
				<div class="flex gap-2">
					{#each [
						{ value: 1, label: '1x', descKey: 'qualityLow' },
						{ value: 2, label: '2x', descKey: 'qualityMedium' },
						{ value: 3, label: '3x', descKey: 'qualityHigh' }
					] as scale}
						<button
							class="flex-1 p-3 border rounded-lg text-center transition-all touch-manipulation active:scale-95 {config.exportScale === scale.value
								? 'border-black bg-black text-white ring-2 ring-offset-2 ring-black'
								: 'hover:bg-secondary active:bg-secondary'}"
							onclick={() => updateConfig('exportScale', scale.value as 1 | 2 | 3)}
						>
							<span class="block font-medium">{scale.label}</span>
							<span class="text-xs opacity-70">{i18n.t(scale.descKey as any)}</span>
						</button>
					{/each}
				</div>
				<p class="text-xs text-muted-foreground mt-2">
					{i18n.t('qualityNote')}
				</p>
			</div>
		</div>
	</div>
</div>

<InputDialog
	bind:open={showSaveDialog}
	title={i18n.t('enterConfigName')}
	placeholder={i18n.t('configName') || '설정 이름'}
	onConfirm={handleSaveConfig}
	onCancel={() => (showSaveDialog = false)}
/>
