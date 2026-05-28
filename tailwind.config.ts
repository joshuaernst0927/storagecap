import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: '#D4A843',
        navy: '#1B2B5E',
        'dark-bg': '#FFFFFF',
        'dark-surface': '#F4F6F9',
        'dark-border': '#E0DDD4',
        'dark-muted': '#6B6860',
        'ink': '#1A1A18',
        'forest': '#2D6A4F',
      },
      fontFamily: {
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
        sans: ['var(--font-jost)', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        widest2: '0.3em',
        widest3: '0.4em',
      },
    },
  },
  plugins: [],
}

export default config
