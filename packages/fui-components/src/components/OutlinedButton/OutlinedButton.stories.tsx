import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  OutlinedButton,
  type OutlinedButtonProps,
  type ButtonColor,
} from './OutlinedButton';
import { fn } from 'storybook/test';

const meta = {
  title: 'Components/OutlinedButton',
  component: OutlinedButton,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    color: {
      control: 'select',
      options: [
        'primary',
        'secondary',
        'success',
        'error',
        'warning',
        'accent-purple',
        'accent-falcon',
        'neutral',
      ],
      description: 'The color scheme of the button',
    },
    selected: {
      control: 'boolean',
      description:
        'Statically applies the hover fill, for toggle-style button groups',
    },
    children: {
      control: 'text',
      description: 'The content of the button',
    },
    onClick: { action: 'clicked' },
  },
  args: {
    onClick: fn(),
    children: 'Button Text', // Default text for all stories
  },
} satisfies Meta<typeof OutlinedButton>;

export default meta;
type Story = StoryObj<typeof meta>;

const ColorStory = (name: string, color: ButtonColor) => {
  return {
    name: name,
    args: {
      color: color,
      children: 'Button',
    },
    render: (args: OutlinedButtonProps) => (
      <OutlinedButton color={color} {...args}>
        {args.children}
      </OutlinedButton>
    ),
  };
};

export const ColorPrimary: Story = ColorStory('Primary', 'primary');
export const ColorSecondary: Story = ColorStory('Secondary', 'secondary');
export const ColorSuccess: Story = ColorStory('Success', 'success');
export const ColorError: Story = ColorStory('Error', 'error');
export const ColorWarning: Story = ColorStory('Warning', 'warning');
export const ColorAccentPurple: Story = ColorStory(
  'AccentPurple',
  'accent-purple',
);
export const ColorAccentFalcon: Story = ColorStory(
  'AccentFalcon',
  'accent-falcon',
);
export const ColorNeutral: Story = ColorStory('Neutral', 'neutral');

export const AsLink: Story = {
  name: 'As Link (anchor)',
  args: {
    color: 'primary',
    children: 'Go somewhere',
  },
  render: (args: OutlinedButtonProps) => (
    <OutlinedButton component="a" href="#" {...args}>
      {args.children}
    </OutlinedButton>
  ),
};

export const Selected: Story = {
  name: 'Selected',
  args: {
    color: 'primary',
    selected: true,
    children: 'Button',
  },
  render: (args: OutlinedButtonProps) => <OutlinedButton {...args} />,
};
