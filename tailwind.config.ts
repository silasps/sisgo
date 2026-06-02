import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta baseada no laranja JOCUM #F47920
        brand: {
          50:  '#fff8f1',
          100: '#ffeedd',
          200: '#fdd9b5',
          300: '#fbb97f',
          400: '#f89547',
          500: '#f47920', // laranja JOCUM
          600: '#e05e0a',
          700: '#ba480b',
          800: '#963a10',
          900: '#7a3111',
          950: '#1c0d04',
        },
        // Fundo escuro do sidebar (quase preto, levemente quente)
        dark: {
          800: '#1e1612',
          900: '#140e0a',
          950: '#0d0905',
        },
      },
    },
  },
  plugins: [],
}

export default config
