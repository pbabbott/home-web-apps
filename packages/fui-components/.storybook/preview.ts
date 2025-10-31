import type { Preview } from '@storybook/react-vite';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import '../globals.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      options: {
        dark: {
          name: 'Dark',
          // This is neutral-800 from tailwind.config.ts
          value: '#2E373B',
        },
        light: {
          name: 'Light',
          // This is neutral-50 from tailwind.config.ts
          value: '#F8F8F8',
        },
      },
    },

    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
  },
  initialGlobals: {
    backgrounds: { value: 'dark' },
  },
};

export default preview;

export const decorators = [
  withThemeByDataAttribute({
    themes: {
      dark: 'dark',
    },
    defaultTheme: 'dark',
    attributeName: 'data-mode',
  }),
];
