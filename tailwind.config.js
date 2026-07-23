/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				canvas: 'oklch(var(--canvas) / <alpha-value>)',
				surface: 'oklch(var(--surface) / <alpha-value>)',
				background: 'oklch(var(--background) / <alpha-value>)',
				foreground: 'oklch(var(--foreground) / <alpha-value>)',
				card: {
					DEFAULT: 'oklch(var(--card) / <alpha-value>)',
					foreground: 'oklch(var(--card-foreground) / <alpha-value>)'
				},
				popover: {
					DEFAULT: 'oklch(var(--popover) / <alpha-value>)',
					foreground: 'oklch(var(--popover-foreground) / <alpha-value>)'
				},
				primary: {
					DEFAULT: 'oklch(var(--primary) / <alpha-value>)',
					foreground: 'oklch(var(--primary-foreground) / <alpha-value>)'
				},
				secondary: {
					DEFAULT: 'oklch(var(--secondary) / <alpha-value>)',
					foreground: 'oklch(var(--secondary-foreground) / <alpha-value>)'
				},
				muted: {
					DEFAULT: 'oklch(var(--muted) / <alpha-value>)',
					foreground: 'oklch(var(--muted-foreground) / <alpha-value>)'
				},
				accent: {
					DEFAULT: 'oklch(var(--accent) / <alpha-value>)',
					foreground: 'oklch(var(--accent-foreground) / <alpha-value>)'
				},
				destructive: {
					DEFAULT: 'oklch(var(--destructive) / <alpha-value>)',
					foreground: 'oklch(var(--destructive-foreground) / <alpha-value>)'
				},
				warning: {
					DEFAULT: 'oklch(var(--warning) / <alpha-value>)',
					foreground: 'oklch(var(--warning-foreground) / <alpha-value>)'
				},
				'warning-soft': 'oklch(var(--warning-soft) / <alpha-value>)',
				success: 'oklch(var(--success) / <alpha-value>)',
				border: 'oklch(var(--border) / <alpha-value>)',
				input: 'oklch(var(--input) / <alpha-value>)',
				ring: 'oklch(var(--ring) / <alpha-value>)'
			},
			borderRadius: {
				sm: 'var(--radius-sm)',
				md: 'var(--radius-md)',
				lg: 'var(--radius-lg)',
				xl: 'var(--radius-xl)',
				'2xl': 'var(--radius-2xl)'
			},
			fontFamily: {
				sans: [
					'Inter Variable',
					'Pretendard',
					'-apple-system',
					'Segoe UI',
					'Malgun Gothic',
					'ui-sans-serif',
					'system-ui',
					'sans-serif'
				],
				mono: [
					'JetBrains Mono Variable',
					'ui-monospace',
					'SFMono-Regular',
					'Menlo',
					'monospace'
				]
			}
		}
	},
	plugins: []
};
