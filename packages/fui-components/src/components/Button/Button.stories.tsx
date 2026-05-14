import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Button,
  type ButtonColor,
  type ButtonProps,
  type ButtonVariant,
} from './Button';
import { fn } from 'storybook/test';

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['contained', 'outlined', 'text'],
      description: 'The variant of the button',
    },
    color: {
      control: 'select',
      options: [
        'primary',
        'secondary',
        'success',
        'error',
        'warning',
        'accentPurple',
        'accentFalcon',
      ],
      description: 'The color scheme of the button',
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
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

const ButtonStory = (
  name: string,
  color: ButtonColor,
  variant: ButtonVariant = 'contained',
) => {
  return {
    name: name,
    args: {
      color: color,
      children: 'Button',
      variant: variant,
    },
    render: (args: ButtonProps) => (
      <Button color={color} {...args}>
        {args.children}
      </Button>
    ),
  };
};

export const ColorPrimary: Story = ButtonStory('Primary', 'primary');
export const ColorSecondary: Story = ButtonStory('Secondary', 'secondary');
export const ColorSuccess: Story = ButtonStory('Success', 'success');
export const ColorError: Story = ButtonStory('Error', 'error');
export const ColorWarning: Story = ButtonStory('Warning', 'warning');
export const ColorAccentPurple: Story = ButtonStory(
  'AccentPurple',
  'accent-purple',
);
export const ColorAccentFalcon: Story = ButtonStory(
  'AccentFalcon',
  'accent-falcon',
);

export const VariantContained: Story = ButtonStory(
  'Contained',
  'primary',
  'contained',
);
export const VariantOutlined: Story = ButtonStory(
  'Outlined',
  'primary',
  'outlined',
);
export const VariantText: Story = ButtonStory('Text', 'primary', 'text');
