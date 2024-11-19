
import type { Config } from 'tailwindcss';

//  https://tailwindcss.com/docs/customizing-colors

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', './.storybook/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-mode="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'magenta',
          secondary: 'cyan',
          accent: 'red',
        },
      },
    },
  },
  plugins: [],
};

export default config;
