import { browser } from '$app/environment';
import type { User } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase';
import { config } from '$lib/config';

function createAuthStore() {
	let user = $state<User | null>(null);
	let loading = $state(true);

	// 초기화
	async function initialize() {
		if (!browser) {
			loading = false;
			return;
		}

		try {
			const {
				data: { session }
			} = await supabase.auth.getSession();
			if (session) {
				user = session.user;
			}
		} catch (e) {
			console.error('Auth initialization error:', e);
		} finally {
			loading = false;
		}

		// 인증 상태 변경 리스너
		supabase.auth.onAuthStateChange((_event, session) => {
			user = session?.user || null;
		});
	}

	// 로그인 관련 경로인지 확인
	function isLoginPath(path: string): boolean {
		return (
			path === '/login' ||
			path.endsWith('/login') ||
			path.includes('/auth/') ||
			path.includes('/callback')
		);
	}

	// Google 로그인 URL 생성
	function getGoogleLoginUrl(): string {
		if (!browser) {
			return `${config.auth.workerUrl}/google?appId=${config.auth.appId}&returnTo=${encodeURIComponent('/')}`;
		}

		const currentPath = window.location.pathname;
		// 로그인 페이지면 기본 경로로, 아니면 현재 경로 유지
		const returnTo = isLoginPath(currentPath) ? '/' : currentPath;

		return `${config.auth.workerUrl}/google?appId=${config.auth.appId}&returnTo=${encodeURIComponent(returnTo)}`;
	}

	// 로그아웃
	async function signOut() {
		await supabase.auth.signOut();
		user = null;
	}

	return {
		get user() {
			return user;
		},
		get loading() {
			return loading;
		},
		get isAuthenticated() {
			return !!user;
		},

		initialize,
		getGoogleLoginUrl,
		signOut
	};
}

export const authStore = createAuthStore();
