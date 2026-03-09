import type { Config } from 'tailwindcss';

export default {
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  theme: {
    extend: {
      colors: {
        ink: '#14213d',
        ember: '#ef476f',
        sand: '#f8f3e8',
        mint: '#06d6a0',
        gold: '#f4a261',
      },
      boxShadow: {
        panel: '0 18px 40px rgba(20, 33, 61, 0.16)',
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"Segoe UI"', 'sans-serif'],
        body: ['"DM Sans"', '"Segoe UI"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
