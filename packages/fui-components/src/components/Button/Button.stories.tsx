import React from 'react'
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { Button } from './Button';

const meta = {
  title: 'Example/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['contained', 'outlined', 'text'],
      description: 'The variant of the button'
    },
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'success', 'error', 'warning', 'accentPurple', 'accentFalcon'],
      description: 'The color scheme of the button'
    },
    children: {
      control: 'text',
      description: 'The content of the button'
    },
    onClick: { action: 'clicked' }
  },
  args: { 
    onClick: fn(),
    children: 'Button Text' // Default text for all stories
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: 'contained',
    color: 'primary',
    children: 'Primary Button'
  }
};

export const Secondary: Story = {
  args: {
    variant: 'contained',
    color: 'secondary',
    children: 'Secondary Button'
  }
};

export const Outlined: Story = {
  args: {
    variant: 'outlined',
    color: 'primary',
    children: 'Outlined Button'
  }
};

export const TextVariant: Story = {
  args: {
    variant: 'text',
    color: 'primary',
    children: 'Text Button'
  }
};

export const Success: Story = {
  args: {
    variant: 'contained',
    color: 'success',
    children: 'Success Button'
  }
};

export const Error: Story = {
  args: {
    variant: 'contained',
    color: 'error',
    children: 'Delete'
  }
};

export const Warning: Story = {
  args: {
    variant: 'contained',
    color: 'warning',
    children: 'Warning'
  }
};

export const AccentPurple: Story = {
  args: {
    variant: 'contained',
    color: 'accent-purple',
    children: 'Accent Purple'
  }
};

export const AccentFalcon: Story = {
  args: {
    variant: 'contained',
    color: 'accent-falcon',
    children: 'Accent Falcon'
  }
};

// Example showing all variants for a color
export const AllVariants: Story = {
  render: (args) => (
    <div className="flex gap-4">
      <Button {...args} variant="contained">Contained</Button>
      <Button {...args} variant="outlined">Outlined</Button>
      <Button {...args} variant="text">Text</Button>
    </div>
  )
};

// Example showing all colors in a grid
export const ColorShowcase: Story = {
  render: (args) => (
    <div className="grid grid-cols-2 gap-4">
      <Button {...args} color="primary">Primary</Button>
      <Button {...args} color="secondary">Secondary</Button>
      <Button {...args} color="success">Success</Button>
      <Button {...args} color="error">Error</Button>
      <Button {...args} color="warning">Warning</Button>
      <Button {...args} color="accent-purple">Accent Purple</Button>
      <Button {...args} color="accent-falcon">Accent Falcon</Button>
    </div>
  )
};