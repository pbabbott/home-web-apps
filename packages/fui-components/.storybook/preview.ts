// .storybook/preview.js

import '../src/styles.scss'; // replace with the name of your tailwind css file

import { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'slate-800',
      values: [
        {
          name: 'slate-800',
          value: '#2E373B',
        },
      ],
    },
  },
};

export default preview;