import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:      '#6366f1',
        accent:       '#f59e0b',
        surface:      '#1e1e2e',
        surfaceLight: '#2a2a3e',
        textPrimary:  '#e2e8f0',
        textSecondary:'#94a3b8',
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
