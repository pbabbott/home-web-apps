import type { Config } from 'tailwindcss';
import { brandColors } from './src/tokens/colors';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}', './.storybook/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-mode="dark"]'],
  theme: {
    extend: {
      fontSize: {
        h1: ['3rem', { lineHeight: '1' }], // 48px
        h2: ['2.125rem', { lineHeight: '1' }], // 34px
        h3: ['4.25rem', { lineHeight: '.7' }], // 68px
        h4: ['3.5rem', { lineHeight: '.8' }], // 56px
        h5: ['2.5rem', { lineHeight: '.8' }], // 40px
        h6: ['2.25rem', { lineHeight: '.8' }], // 36px
        body1: ['2rem', { lineHeight: '.8' }], // 32px
        body2: ['1.75rem', { lineHeight: '.8' }], // 28px
        button: ['1.75rem', { lineHeight: '.8' }], // 28px
        caption: ['1.375rem', { lineHeight: '.8' }], // 22px
        small: ['1.125rem', { lineHeight: '.8' }], // 18px
      },
      fontFamily: {
        monobit: ['monobit', 'sans-serif'],
        ethnocentric: ['ethnocentric', 'serif'],
      },
      colors: brandColors,
    },
  },
  plugins: [],
};

export default config;
