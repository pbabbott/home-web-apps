import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { ListItemButton } from './ListItemButton';

const meta = {
  title: 'Components/ListItemButton',
  component: ListItemButton,
  parameters: { layout: 'padded' },
  argTypes: {
    children: { control: 'text', description: 'The row text' },
    color: {
      control: 'select',
      options: [
        'neutral',
        'primary',
        'secondary',
        'success',
        'error',
        'warning',
        'accent-purple',
        'accent-falcon',
        'dark',
      ],
      description: 'Translucent fill color (hover and selected)',
    },
    selected: { control: 'boolean', description: 'Current selection' },
    disabled: { control: 'boolean', description: 'Disables interaction' },
    startAdornment: { control: false, description: 'Shown before the text' },
    endAdornment: { control: false, description: 'Shown after the text' },
    onClick: { action: 'clicked' },
  },
  args: { children: 'List item button', onClick: fn() },
  decorators: [
    (Story) => (
      <div className="flex w-96 flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ListItemButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Selected: Story = { args: { selected: true } };
export const Disabled: Story = { args: { disabled: true } };

export const Adornments: Story = {
  args: {
    children: '/Volumes/Photos/2019',
    startAdornment: <div className="size-3 bg-primary-400" />,
    endAdornment: <div className="h-2 w-8 bg-neutral-400" />,
  },
};

export const LongText: Story = {
  args: {
    children:
      '/Volumes/Photos/2019/Summer/A/very/deeply/nested/path/with/a/rather/long/file-name-that-must-wrap.jpg',
    startAdornment: <div className="size-3 bg-neutral-400" />,
  },
};

/** One grid of states side by side. */
export const States: Story = {
  render: () => (
    <>
      <ListItemButton>Idle</ListItemButton>
      <ListItemButton selected>Selected</ListItemButton>
      <ListItemButton disabled>Disabled</ListItemButton>
    </>
  ),
};

// Selected, so the fill is visible without hovering.
export const ColorPrimary: Story = {
  args: { color: 'primary', selected: true, children: 'primary' },
};
