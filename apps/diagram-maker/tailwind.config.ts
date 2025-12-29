import type { Config } from 'tailwindcss';
import fuiConfig from '@abbottland/fui-components/tailwind.config';

const config: Config = {
  presets: [fuiConfig],
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
};

export default config;

