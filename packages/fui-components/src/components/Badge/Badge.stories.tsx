import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge, type BadgeColor, type BadgeProps } from './Badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
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
      ],
      description: 'The color scheme of the badge',
    },
    children: {
      control: 'text',
      description: 'The content of the badge',
    },
  },
  args: {
    children: 'Badge',
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

const BadgeStory = (name: string, color: BadgeColor) => {
  return {
    name: name,
    args: {
      color: color,
      children: name,
    },
    render: (args: BadgeProps) => (
      <Badge color={color} {...args}>
        {args.children}
      </Badge>
    ),
  };
};

export const ColorPrimary: Story = BadgeStory('Primary', 'primary');
export const ColorSecondary: Story = BadgeStory('Secondary', 'secondary');
export const ColorSuccess: Story = BadgeStory('Success', 'success');
export const ColorError: Story = BadgeStory('Error', 'error');
export const ColorWarning: Story = BadgeStory('Warning', 'warning');
export const ColorAccentPurple: Story = BadgeStory(
  'Accent Purple',
  'accent-purple',
);
export const ColorAccentFalcon: Story = BadgeStory(
  'Accent Falcon',
  'accent-falcon',
);




