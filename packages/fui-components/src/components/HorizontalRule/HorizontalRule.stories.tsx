import type { Meta, StoryObj } from '@storybook/react-vite';
import { HorizontalRule } from './HorizontalRule';
import { Typography } from '../Typography/Typography';

const meta = {
  title: 'Components/HorizontalRule',
  component: HorizontalRule,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'neutral'],
    },
  },
  args: {
    color: 'primary',
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Typography variant="body1">
          Content above the horizontal rule
        </Typography>
        <Story />
        <Typography variant="body1">
          Content below the horizontal rule
        </Typography>
      </div>
    ),
  ],
} satisfies Meta<typeof HorizontalRule>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    color: 'neutral',
  },
};

export const Primary: Story = {
  args: {
    color: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    color: 'secondary',
  },
};

export const CustomSpacing: Story = {
  args: {
    className: 'my-8',
    color: 'primary',
  },
};
