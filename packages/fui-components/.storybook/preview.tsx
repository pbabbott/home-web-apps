import type { Preview } from "@storybook/react";
import { withThemeByClassName } from '@storybook/addon-themes';
import '../src/styles/index.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;

export const decorators = [
  withThemeByClassName({
    themes: {
      light: 'bg-neutral-200',
      dark: 'bg-neutral-800',
    },
    defaultTheme: 'dark',
  }),
];