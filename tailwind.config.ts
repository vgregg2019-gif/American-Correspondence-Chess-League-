import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'accl-black': '#0a0a0a',
        'accl-charcoal': '#1a1a1a',
        'accl-gray': '#2a2a2a',
        'accl-red': '#8b0000',
        'accl-red-light': '#a52a2a',
      },
    },
  },
  plugins: [],
}
export default config
