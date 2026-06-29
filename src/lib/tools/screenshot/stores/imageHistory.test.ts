/**
 * Unit tests for imageHistory.exportToGCS()
 *
 * RIGHT-BICEP coverage:
 * - Inverse: flag=false → no fetch calls, null returned
 * - Right: flag=true + successful upload → signed URL returned
 * - Error: server returns 404 → null returned (caller handles error)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks — must be declared before the imports that use them
// ---------------------------------------------------------------------------

// Mock $app/environment so the store treats the test as browser context
vi.mock('$app/environment', () => ({ browser: true }));

// We need to control the PUBLIC_ENABLE_GCS_EXPORT value per test.
// We'll use a mutable object as the env mock.
const mockPublicEnv: Record<string, string> = {};
vi.mock('$env/dynamic/public', () => ({
	get env() {
		return mockPublicEnv;
	}
}));

// ---------------------------------------------------------------------------
// Now import the module under test (after mocks are in place)
// ---------------------------------------------------------------------------
import { imageHistory } from './imageHistory.js';

// ---------------------------------------------------------------------------
// Helper: reset env between tests
// ---------------------------------------------------------------------------
function setGcsEnabled(value: 'true' | 'false' | undefined) {
	if (value === undefined) {
		delete mockPublicEnv.PUBLIC_ENABLE_GCS_EXPORT;
	} else {
		mockPublicEnv.PUBLIC_ENABLE_GCS_EXPORT = value;
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('imageHistory.exportToGCS()', () => {
	beforeEach(() => {
		// Reset env and global fetch mock before each test
		setGcsEnabled(undefined);
		vi.restoreAllMocks();
	});

	// ------------------------------------------------------------------
	// Inverse: feature disabled → no fetch, null returned
	// ------------------------------------------------------------------

	it('returns null and calls no fetch when PUBLIC_ENABLE_GCS_EXPORT is not set', async () => {
		setGcsEnabled(undefined);
		const fetchSpy = vi.spyOn(global, 'fetch');

		const result = await imageHistory.exportToGCS(
			'data:image/png;base64,abc',
			'test.png'
		);

		expect(result).toBeNull();
		// fetch should NOT have been called for the upload endpoint
		expect(fetchSpy).not.toHaveBeenCalledWith(
			'/api/gcs-export',
			expect.anything()
		);
	});

	it('returns null and calls no fetch when PUBLIC_ENABLE_GCS_EXPORT is "false"', async () => {
		setGcsEnabled('false');
		const fetchSpy = vi.spyOn(global, 'fetch');

		const result = await imageHistory.exportToGCS(
			'data:image/png;base64,abc',
			'test.png'
		);

		expect(result).toBeNull();
		expect(fetchSpy).not.toHaveBeenCalledWith(
			'/api/gcs-export',
			expect.anything()
		);
	});

	// ------------------------------------------------------------------
	// Right: feature enabled, successful upload → signed URL returned
	// ------------------------------------------------------------------

	it('returns signed URL when upload succeeds (PUBLIC_ENABLE_GCS_EXPORT="true")', async () => {
		setGcsEnabled('true');

		const signedUrl = 'https://storage.googleapis.com/bucket/obj?X-Goog-Signature=abc';

		// Mock global.fetch: first call is dataUrl → Blob conversion (internal),
		// second call is the actual POST to /api/gcs-export.
		// The implementation does `fetch(dataUrl)` to get a blob, then
		// `fetch('/api/gcs-export', {...})` to upload.
		vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
			if (typeof input === 'string' && input.startsWith('data:')) {
				// Simulate the dataUrl → Blob conversion fetch
				return new Response(new Blob(['fake-image'], { type: 'image/png' }));
			}
			// Simulate the upload endpoint response
			return new Response(JSON.stringify({ url: signedUrl }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		});

		const result = await imageHistory.exportToGCS(
			'data:image/png;base64,iVBORw0KGgo=',
			'screenshot.png'
		);

		expect(result).toBe(signedUrl);
	});

	// ------------------------------------------------------------------
	// Error: server returns 404 → null returned
	// ------------------------------------------------------------------

	it('returns null when upload endpoint returns 404', async () => {
		setGcsEnabled('true');

		vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
			if (typeof input === 'string' && input.startsWith('data:')) {
				return new Response(new Blob(['fake-image'], { type: 'image/png' }));
			}
			return new Response('Not found', { status: 404 });
		});

		const result = await imageHistory.exportToGCS(
			'data:image/png;base64,iVBORw0KGgo=',
			'screenshot.png'
		);

		expect(result).toBeNull();
	});

	// ------------------------------------------------------------------
	// Error: network failure → null returned (no unhandled rejection)
	// ------------------------------------------------------------------

	it('returns null when fetch throws a network error', async () => {
		setGcsEnabled('true');

		vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

		const result = await imageHistory.exportToGCS(
			'data:image/png;base64,iVBORw0KGgo=',
			'screenshot.png'
		);

		expect(result).toBeNull();
	});
});
