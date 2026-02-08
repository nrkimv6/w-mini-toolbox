import { writable, get, derived } from 'svelte/store';
import { translations, type Locale, type TranslationKey } from './translations';

function createI18nStore() {
	const { subscribe, set, update } = writable<Locale>('en');

	// Initialize on client side only
	if (typeof window !== 'undefined') {
		const saved = localStorage.getItem('locale') as Locale | null;
		if (saved && (saved === 'en' || saved === 'ko')) {
			set(saved);
		} else {
			// Detect browser language
			const browserLang = navigator.language.toLowerCase();
			if (browserLang.startsWith('ko')) {
				set('ko');
			}
		}
	}

	return {
		subscribe,
		get locale() {
			return get({ subscribe });
		},
		setLocale(locale: Locale) {
			set(locale);
			if (typeof window !== 'undefined') {
				localStorage.setItem('locale', locale);
			}
		},
		t(key: TranslationKey): string {
			const currentLocale = get({ subscribe });
			return translations[currentLocale][key] || translations['en'][key] || key;
		}
	};
}

export const i18n = createI18nStore();

// Reactive t function - use as $t('key') in components for auto-update on locale change
export const t = derived(i18n, ($locale) => {
	return (key: TranslationKey): string => {
		return translations[$locale][key] || translations['en'][key] || key;
	};
});

export { type Locale, type TranslationKey } from './translations';
