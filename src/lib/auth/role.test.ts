import { describe, expect, it } from 'vitest';
import { resolveIsAdmin } from './role.js';
import type { User } from '@supabase/supabase-js';

describe('resolveIsAdmin', () => {
	it('resolveIsAdmin_null_비로그인_false', () => {
		expect(resolveIsAdmin(null)).toBe(false);
	});

	it('resolveIsAdmin_undefined_비로그인_false', () => {
		expect(resolveIsAdmin(undefined)).toBe(false);
	});

	it('resolveIsAdmin_userMetadata_admin_true', () => {
		const user = {
			user_metadata: { role: 'admin' },
			app_metadata: {}
		} as unknown as User;
		expect(resolveIsAdmin(user)).toBe(true);
	});

	it('resolveIsAdmin_userMetadata없고_appMetadata_admin_fallback_true', () => {
		const user = {
			user_metadata: {},
			app_metadata: { role: 'admin' }
		} as unknown as User;
		expect(resolveIsAdmin(user)).toBe(true);
	});

	it('resolveIsAdmin_role없음_false', () => {
		const user = {
			user_metadata: {},
			app_metadata: {}
		} as unknown as User;
		expect(resolveIsAdmin(user)).toBe(false);
	});

	it('resolveIsAdmin_role_user_false', () => {
		const user = {
			user_metadata: { role: 'user' },
			app_metadata: {}
		} as unknown as User;
		expect(resolveIsAdmin(user)).toBe(false);
	});

	it('resolveIsAdmin_metadata_undefined_예외없이_false', () => {
		const user = {
			user_metadata: undefined,
			app_metadata: undefined
		} as unknown as User;
		expect(() => resolveIsAdmin(user)).not.toThrow();
		expect(resolveIsAdmin(user)).toBe(false);
	});
});
