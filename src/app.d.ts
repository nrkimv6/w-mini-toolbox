// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				ASSETS: Fetcher;
				/** Gemini Assist feature flag (wrangler vars 또는 secret) */
				ENABLE_GEMINI_ASSIST?: string;
				/** Gemini Developer API key (wrangler secret put GEMINI_API_KEY) */
				GEMINI_API_KEY?: string;
			};
			context: ExecutionContext;
			caches: CacheStorage & { default: Cache };
		}
	}
}

declare const __APP_VERSION__: string;

export {};
