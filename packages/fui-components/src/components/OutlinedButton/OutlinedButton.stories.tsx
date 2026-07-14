import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  OutlinedButton,
  type OutlinedButtonProps,
  type ButtonColor,
} from './OutlinedButton';
import { fn } from 'storybook/test';
import { MixerVerticalIcon } from '@radix-ui/react-icons';

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
    size: {
      control: 'select',
      options: ['default', 'small'],
      description: 'The size of the button',
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

export const SizeSmall: Story = {
  name: 'Size Small',
  args: {
    color: 'primary',
    size: 'small',
    children: 'Button',
  },
  render: (args: OutlinedButtonProps) => <OutlinedButton {...args} />,
};

// Regression coverage: on the blog's system-architecture page, this button's
// text goes black on hover but its icon didn't follow, because fui-icons'
// `Icon` hardcodes a fixed text color class on the icon instead of letting it
// inherit `currentColor`. Fixed the same way the real usage is: `!text-current`
// forces the icon to track the button's inherited color (idle or hover)
// regardless of Tailwind's compiled class order. `selected` statically
// applies the same fill OutlinedButton uses on hover (see doc comment above),
// which is how this repo's screenshot pipeline captures the hover look since
// it can't simulate a real :hover pointer state.
export const HoveredWithIcon: Story = {
  name: 'Primary, Hovered, With Icon',
  args: {
    color: 'primary',
    selected: true,
  },
  render: (args: OutlinedButtonProps) => (
    <OutlinedButton {...args}>
      <span className="flex items-center gap-2">
        <MixerVerticalIcon className="!text-current" />
        Media Stack
      </span>
    </OutlinedButton>
  ),
};
