import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { FuiButton } from './FuiButton';

const meta = {
  title: 'Example/FuiButton',
  component: FuiButton,
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
} satisfies Meta<typeof FuiButton>;

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
    color: 'accentPurple',
    children: 'Accent Purple'
  }
};

export const AccentFalcon: Story = {
  args: {
    variant: 'contained',
    color: 'accentFalcon',
    children: 'Accent Falcon'
  }
};

// // Example showing all variants for a color
// export const AllVariants: Story = {
//   render: (args) => (
//     <div className="flex gap-4">
//       <FuiButton {...args} variant="contained">Contained</FuiButton>
//       <FuiButton {...args} variant="outlined">Outlined</FuiButton>
//       <FuiButton {...args} variant="text">Text</FuiButton>
//     </div>
//   )
// };

// // Example showing all colors in a grid
// export const ColorShowcase: Story = {
//   render: (args) => (
//     <div className="grid grid-cols-2 gap-4">
//       <FuiButton {...args} color="primary">Primary</FuiButton>
//       <FuiButton {...args} color="secondary">Secondary</FuiButton>
//       <FuiButton {...args} color="success">Success</FuiButton>
//       <FuiButton {...args} color="error">Error</FuiButton>
//       <FuiButton {...args} color="warning">Warning</FuiButton>
//       <FuiButton {...args} color="accentPurple">Accent Purple</FuiButton>
//       <FuiButton {...args} color="accentFalcon">Accent Falcon</FuiButton>
//     </div>
//   )
// };