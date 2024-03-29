// Button.stories.ts|tsx

import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

const argTypes = {
  label: {
    control: 'text',
    defaultValue: 'primary'
  },
  onClick: { action: 'clicked' }
}

export const Primary: Story = {
  args: {
    type: 'primary',
    label: 'button',
    disabled: false,
  },
  argTypes
}

export const Secondary: Story = {
  args: {
    type: 'secondary',
    label: 'button',
    disabled: false,
  },
  argTypes
}

export const Disabled: Story = {
  args: {
    type: 'primary',
    label: 'button',
    disabled: true,
  },
  argTypes
}