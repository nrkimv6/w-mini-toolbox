import { browser } from '$app/environment';
import type { ScreenshotConfig } from '$lib/tools/screenshot/types/config';

const STORAGE_KEY = 'screenshot-config-history';
const MAX_HISTORY = 5;

export interface SavedConfig {
	id: string;
	name: string;
	config: ScreenshotConfig;
	createdAt: string;
}

function createConfigHistoryStore() {
	let _history: SavedConfig[] = [];

	function loadFromStorage() {
		if (!browser) return;
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				_history = JSON.parse(saved);
			}
		} catch (e) {
			console.error('Failed to load config history', e);
		}
	}

	function saveToStorage() {
		if (!browser) return;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(_history));
	}

	// Load on init
	loadFromStorage();

	return {
		getHistory(): SavedConfig[] {
			loadFromStorage();
			return _history;
		},

		saveConfig(name: string, config: SavedConfig['config']) {
			loadFromStorage();
			const newConfig: SavedConfig = {
				id: crypto.randomUUID(),
				name: name || `설정 ${_history.length + 1}`,
				config,
				createdAt: new Date().toISOString()
			};

			_history = [newConfig, ..._history].slice(0, MAX_HISTORY);
			saveToStorage();
		},

		deleteConfig(id: string) {
			loadFromStorage();
			_history = _history.filter((c) => c.id !== id);
			saveToStorage();
		},

		clearHistory() {
			_history = [];
			saveToStorage();
		}
	};
}

export const configHistory = createConfigHistoryStore();
