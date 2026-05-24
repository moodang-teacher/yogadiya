import type { Config } from 'tailwindcss';

const config: Config = {
	content: [
		'./src/pages/**/*.{js,ts,jsx,tsx,mdx}',
		'./src/components/**/*.{js,ts,jsx,tsx,mdx}',
		'./src/app/**/*.{js,ts,jsx,tsx,mdx}',
	],
	theme: {
		extend: {
			// ── Amber & Earth 디자인 시스템 ──────────────────────
			colors: {
				primary: {
					DEFAULT: '#442a22',
					container: '#5d4037',
					fixed: '#ffdbd0',
					'fixed-dim': '#e7bdb1',
				},
				'on-primary': '#ffffff',
				'on-primary-container': '#d4ada1',
				'inverse-primary': '#e7bdb1',
				secondary: {
					DEFAULT: '#795900',
					container: '#fec330',
					fixed: '#ffdfa0',
					'fixed-dim': '#f8bd2a',
				},
				'on-secondary': '#ffffff',
				'on-secondary-container': '#6f5100',
				tertiary: {
					DEFAULT: '#432b22',
					container: '#5b4137',
				},
				surface: {
					DEFAULT: '#fff8f5',
					dim: '#e1d8d4',
					bright: '#fff8f5',
					'container-lowest': '#ffffff',
					'container-low': '#fbf2ed',
					container: '#f5ece7',
					'container-high': '#efe6e2',
					'container-highest': '#e9e1dc',
					tint: '#77574d',
					variant: '#e9e1dc',
				},
				accent: {
					DEFAULT: 'var(--color-accent)',
					foreground: 'var(--color-on-accent)',
				},
				'on-surface': '#1e1b18',
				'on-surface-variant': '#504441',
				'inverse-surface': '#34302c',
				'inverse-on-surface': '#f8efea',
				outline: {
					DEFAULT: '#827470',
					variant: '#d4c3be',
				},
				error: {
					DEFAULT: '#ba1a1a',
					container: '#ffdad6',
				},
				'on-error': '#ffffff',
				'on-error-container': '#93000a',
				background: '#fff8f5',
				'on-background': '#1e1b18',
			},

			fontFamily: {
				sans: [
					'Pretendard',
					'Roboto Flex',
					'-apple-system',
					'BlinkMacSystemFont',
					'sans-serif',
				],
				display: ['Roboto Flex', 'Pretendard', 'sans-serif'],
			},

			fontSize: {
				'display-lg': [
					'56px',
					{ lineHeight: '64px', letterSpacing: '-0.02em', fontWeight: '700' },
				],
				'headline-lg': [
					'32px',
					{ lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '600' },
				],
				'headline-lg-mobile': [
					'28px',
					{ lineHeight: '36px', fontWeight: '600' },
				],
				'headline-md': ['24px', { lineHeight: '32px', fontWeight: '600' }],
				'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
				'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
				'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
				'label-lg': [
					'14px',
					{ lineHeight: '20px', letterSpacing: '0.02em', fontWeight: '600' },
				],
				'label-sm': [
					'12px',
					{ lineHeight: '16px', letterSpacing: '0.04em', fontWeight: '500' },
				],
			},

			borderRadius: {
				sm: '0.25rem',
				DEFAULT: '0.5rem',
				md: '0.75rem',
				lg: '1rem',
				xl: '1.5rem',
				full: '9999px',
			},

			spacing: {
				xs: '4px',
				sm: '12px',
				md: '24px',
				lg: '48px',
				xl: '80px',
				gutter: '24px',
				'margin-mobile': '16px',
				'margin-desktop': '64px',
			},

			boxShadow: {
				card: '0 1px 3px rgba(93, 64, 55, 0.08), 0 1px 2px rgba(93, 64, 55, 0.06)',
				'card-hover':
					'0 4px 12px rgba(93, 64, 55, 0.12), 0 2px 4px rgba(93, 64, 55, 0.08)',
				'bottom-nav':
					'0 -1px 0 rgba(93, 64, 55, 0.1), 0 -4px 16px rgba(93, 64, 55, 0.06)',
			},
		},
	},
	plugins: [],
};

export default config;
