import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

const STORAGE_KEY = 'screenshot-image-history';
const MAX_HISTORY = 10;
const MAX_THUMBNAIL_SIZE = 200; // max width/height for thumbnail

export interface SavedImage {
	id: string;
	thumbnail: string; // Base64 thumbnail
	originalWidth: number;
	originalHeight: number;
	fileName: string;
	createdAt: string;
}

// Create a smaller thumbnail from a data URL
async function createThumbnail(dataUrl: string): Promise<{ thumbnail: string; width: number; height: number }> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				resolve({ thumbnail: dataUrl, width: img.width, height: img.height });
				return;
			}

			// Calculate thumbnail size
			let width = img.width;
			let height = img.height;
			if (width > height) {
				if (width > MAX_THUMBNAIL_SIZE) {
					height = Math.round((height * MAX_THUMBNAIL_SIZE) / width);
					width = MAX_THUMBNAIL_SIZE;
				}
			} else {
				if (height > MAX_THUMBNAIL_SIZE) {
					width = Math.round((width * MAX_THUMBNAIL_SIZE) / height);
					height = MAX_THUMBNAIL_SIZE;
				}
			}

			canvas.width = width;
			canvas.height = height;
			ctx.drawImage(img, 0, 0, width, height);

			resolve({
				thumbnail: canvas.toDataURL('image/jpeg', 0.7),
				width: img.width,
				height: img.height
			});
		};
		img.onerror = () => {
			resolve({ thumbnail: '', width: 0, height: 0 });
		};
		img.src = dataUrl;
	});
}

function createImageHistoryStore() {
	let _history: SavedImage[] = [];

	function loadFromStorage() {
		if (!browser) return;
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				_history = JSON.parse(saved);
			}
		} catch (e) {
			console.error('Failed to load image history', e);
		}
	}

	function saveToStorage() {
		if (!browser) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(_history));
		} catch (e) {
			// localStorage might be full, remove oldest entries
			if (_history.length > 1) {
				_history = _history.slice(0, Math.floor(_history.length / 2));
				try {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(_history));
				} catch {
					console.error('Failed to save image history even after cleanup');
				}
			}
		}
	}

	// Load on init
	loadFromStorage();

	return {
		getHistory(): SavedImage[] {
			loadFromStorage();
			return _history;
		},

		async addImage(dataUrl: string, fileName: string): Promise<SavedImage | null> {
			if (!browser) return null;
			loadFromStorage();

			const { thumbnail, width, height } = await createThumbnail(dataUrl);
			if (!thumbnail) return null;

			const newImage: SavedImage = {
				id: crypto.randomUUID(),
				thumbnail,
				originalWidth: width,
				originalHeight: height,
				fileName,
				createdAt: new Date().toISOString()
			};

			_history = [newImage, ..._history].slice(0, MAX_HISTORY);
			saveToStorage();
			return newImage;
		},

		deleteImage(id: string) {
			loadFromStorage();
			_history = _history.filter((img) => img.id !== id);
			saveToStorage();
		},

		clearHistory() {
			_history = [];
			saveToStorage();
		},

		/**
		 * Upload a screenshot dataUrl to GCS via the server-side signed endpoint.
		 *
		 * Returns the signed download URL on success, or null if the feature is
		 * disabled (PUBLIC_ENABLE_GCS_EXPORT !== 'true'), the code runs on the
		 * server, or the upload fails.
		 *
		 * The caller is responsible for user-facing error handling (toast, etc.).
		 */
		async exportToGCS(dataUrl: string, fileName: string): Promise<string | null> {
			// Client-side feature gate
			if (env.PUBLIC_ENABLE_GCS_EXPORT !== 'true') return null;

			// SSR safety
			if (!browser) return null;

			try {
				// Convert dataUrl to Blob
				const res = await fetch(dataUrl);
				const blob = await res.blob();

				const formData = new FormData();
				formData.append('file', blob, fileName);

				const uploadRes = await fetch('/api/gcs-export', {
					method: 'POST',
					body: formData
				});

				if (!uploadRes.ok) return null;

				const data = (await uploadRes.json()) as { url: string };
				return data.url ?? null;
			} catch {
				return null;
			}
		}
	};
}

export const imageHistory = createImageHistoryStore();
