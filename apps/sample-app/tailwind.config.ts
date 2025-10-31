import type { Config } from 'tailwindcss';
import fuiConfig from 'fui-components/tailwind.config';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: fuiConfig.darkMode,
  theme: {
    extend: {
      ...fuiConfig.theme?.extend,
    },
  },
  plugins: fuiConfig.plugins || [],
};

export default config;
