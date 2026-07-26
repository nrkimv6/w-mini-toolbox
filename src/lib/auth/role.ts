import type { User } from '@supabase/supabase-js';

export const ADMIN_ROLE = 'admin';

/** user_metadata는 Google 로그인 갱신 시 덮어써질 수 있어 app_metadata를 fallback으로 함께 본다. */
export function resolveIsAdmin(u: User | null | undefined): boolean {
	if (!u) return false;
	return u.user_metadata?.role === ADMIN_ROLE || u.app_metadata?.role === ADMIN_ROLE;
}
