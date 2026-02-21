import type { Meta, StoryObj } from '@storybook/react-vite';
import { HexagonButton } from './HexagonButton';

const meta: Meta<typeof HexagonButton> = {
  title: 'Components/HexagonButton',
  component: HexagonButton,
  parameters: {
    layout: 'centered',
  },
  globals: {
    backgrounds: { value: 'dark', grid: true },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          minHeight: '200px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithLabel: Story = {
  args: {
    label: 'SYS',
  },
};

export const WithLabelAndLowerLabel: Story = {
  args: {
    label: 'PWR',
    lowerLabel: 'NODE-02',
  },
};

export const LongLabel: Story = {
  args: {
    label: 'web development',
    lowerLabel: '3',
  },
};

export const Active: Story = {
  args: {
    label: 'NET',
    lowerLabel: 'NODE-03',
    active: true,
  },
};
