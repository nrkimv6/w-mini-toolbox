<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { supabase } from "$lib/supabase";
	import { browser } from "$app/environment";
	import { Loader2 } from "lucide-svelte";
	import { authStore } from "$lib/stores/auth.svelte";
	import { config } from "$lib/config";

	let error = $state<string | null>(null);
	let status = $state<string>("로그인 처리 중...");

	// provider/returnTo/error는 query parameter, 토큰류는 hash fragment
	// (auth-worker가 토큰을 서버 로그에 남기지 않기 위해 hash fragment로 전달함 — src/utils/response.ts 참조)
	function parseQueryParams(): {
		provider?: string;
		access_token?: string;
		id_token?: string;
		supabase_access_token?: string;
		supabase_refresh_token?: string;
		returnTo?: string;
		error?: string;
	} | null {
		if (!browser) return null;

		const searchParams = new URLSearchParams(window.location.search);
		const hashParams = new URLSearchParams(window.location.hash.slice(1));

		const provider = searchParams.get("provider");
		const id_token = hashParams.get("id_token");
		const access_token = hashParams.get("access_token");
		const supabase_access_token = hashParams.get("supabase_access_token");
		const supabase_refresh_token = hashParams.get("supabase_refresh_token");
		const returnTo = searchParams.get("returnTo");
		const errorParam = searchParams.get("error");

		if (errorParam) {
			return { error: errorParam };
		}

		// 카카오는 supabase_access_token이 있고, 구글은 id_token이 있음
		if (provider && (access_token || supabase_access_token)) {
			return {
				provider,
				id_token: id_token || undefined,
				access_token: access_token || undefined,
				supabase_access_token: supabase_access_token || undefined,
				supabase_refresh_token: supabase_refresh_token || undefined,
				returnTo: returnTo || undefined,
			};
		}
		return null;
	}

	onMount(async () => {
		if (!config.supabase.url || !config.supabase.anonKey) {
			error = "Supabase가 설정되지 않았습니다.";
			return;
		}

		try {
			const tokens = parseQueryParams();

			// 에러 처리
			if (tokens?.error) {
				throw new Error(`인증 오류: ${tokens.error}`);
			}

			if (!tokens?.provider) {
				// 기존 세션 확인
				const {
					data: { session },
					error: authError,
				} = await supabase.auth.getSession();

				if (authError) throw authError;

				if (session) {
					await finishLogin(tokens?.returnTo || "/");
					return;
				}

				throw new Error("로그인 정보를 찾을 수 없습니다.");
			}

			status = "인증 처리 중...";

			// 카카오는 Supabase 토큰 직접 사용 (setSession)
			if (tokens.supabase_access_token && tokens.supabase_refresh_token) {
				const { error: sessionError } = await supabase.auth.setSession({
					access_token: tokens.supabase_access_token,
					refresh_token: tokens.supabase_refresh_token,
				});
				if (sessionError) {
					throw sessionError;
				}
			} else if (tokens.id_token && tokens.access_token) {
				// 구글은 기존 방식 (signInWithIdToken)
				const { data, error: signInError } =
					await supabase.auth.signInWithIdToken({
						provider: "google",
						token: tokens.id_token,
						access_token: tokens.access_token,
					});

				if (signInError) {
					throw signInError;
				}

				if (!data.session) {
					throw new Error("세션 생성에 실패했습니다.");
				}
			} else {
				throw new Error("유효한 토큰을 찾을 수 없습니다.");
			}

			await finishLogin(tokens.returnTo || "/");
		} catch (err) {
			console.error("[Auth Callback] Error:", err);
			error =
				err instanceof Error
					? err.message
					: "로그인 처리 중 오류가 발생했습니다.";
		}
	});

	async function finishLogin(returnTo: string) {
		status = "로그인 완료...";

		// Auth store 초기화
		await authStore.initialize();

		// SPA 네비게이션으로 이동
		goto(returnTo, { replaceState: true });
	}
</script>

<div class="flex items-center justify-center bg-background">
	<div
		class="max-w-sm w-full mx-4 p-8 rounded-xl bg-card shadow-lg border border-border"
	>
		{#if error}
			<div class="text-center">
				<p class="text-red-500 mb-4">{error}</p>
				<a
					href="/"
					class="inline-block px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
				>
					홈으로 돌아가기
				</a>
			</div>
		{:else}
			<div class="flex flex-col items-center gap-4">
				<Loader2 class="w-8 h-8 animate-spin text-primary" />
				<p class="text-muted-foreground">{status}</p>
			</div>
		{/if}
	</div>
</div>
