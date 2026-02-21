import type { Meta, StoryObj } from '@storybook/react-vite';
import { TiledHexagons } from './TiledHexagons';

const meta: Meta<typeof TiledHexagons> = {
  title: 'Components/TiledHexagons',
  component: TiledHexagons,
  parameters: {
    layout: 'centered',
  },
  globals: {
    backgrounds: { value: 'dark', grid: true },
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    tiles: [
      { text: 'Hi 1' },
      { text: 'Hi 2' },
      { text: 'Hi 3' },
      { text: 'Hi 4' },
      { text: 'Hi 5' },
      { text: 'Hi 6' },
      { text: 'Hi 7' },
    ],
  },
};

export const CustomGrid: Story = {
  args: {
    maxHorizontal: 4,
    tiles: [
      { label: '1' },
      { label: '2' },
      { label: '3' },
      { label: '4' },
      { label: '5' },
      { label: '6' },
    ],
  },
};

export const CustomGapThreeColumns: Story = {
  args: {
    tileGap: 4,
    maxHorizontal: 3,
    tiles: [
      { label: '1' },
      { label: '2' },
      { label: '3' },
      { label: '4' },
      { label: '5' },
      { label: '6' },
      { label: '7' },
    ],
  },
};
