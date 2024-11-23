import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { Button, ButtonProps } from './Button';

const meta = {
  title: 'Inputs/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
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

const ButtonVariants = (args: ButtonProps) => (
  <div className="flex gap-4">
    <Button {...args} variant="contained">Contained</Button>
    <Button {...args} variant="outlined">Outlined</Button>
    <Button {...args} variant="text">Text</Button>
  </div>
)

export const Primary: Story = {
  name: 'Color: Primary',
  args: {
    color: 'primary'
  },
  render: ButtonVariants
};
export const Secondary: Story = {
  name: 'Color: Secondary',
  args: {
    color: 'secondary'
  },
  render: ButtonVariants
};
export const Success: Story = {
  name: 'Color: Success',
  args: {
    color: 'success'
  },
  render: ButtonVariants
};

export const Error: Story = {
  name: 'Color: Error',
  args: {
    color: 'error'
  },
  render: ButtonVariants
};

export const Warning: Story = {
  name: 'Color: Warning',
  args: {
    color: 'warning'
  },
  render: ButtonVariants
};
export const Purple: Story = {
  name: 'Color: Accent - Purple',
  args: {
    color: 'accent-purple'
  },
  render: ButtonVariants
};
export const AccentFalcon: Story = {
  name: 'Color: Accent - Falcon',
  args: {
    color: 'accent-falcon'
  },
  render: ButtonVariants
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