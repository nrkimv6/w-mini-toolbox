import { env } from '$env/dynamic/public';

export const APP_VERSION = '0.1.0';

export const config = {
	supabase: {
		url: env.PUBLIC_SUPABASE_URL || '',
		anonKey: env.PUBLIC_SUPABASE_ANON_KEY || ''
	},
	auth: {
		workerUrl: env.PUBLIC_AUTH_WORKER_URL || 'https://auth.woory.day',
		appId: env.PUBLIC_APP_ID || 'sample-app'
	}
} as const;
