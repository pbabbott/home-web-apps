import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <div>Card content</div>,
  },
};

export const Primary: Story = {
  args: {
    color: 'primary',
    children: <div>Card content</div>,
  },
};

export const Secondary: Story = {
  args: {
    color: 'secondary',
    children: <div>Card content</div>,
  },
};

export const Large: Story = {
  args: {
    size: 'large',
    children: <div>Card content with large padding</div>,
  },
};

export const LargePrimary: Story = {
  args: {
    size: 'large',
    color: 'primary',
    children: <div>Large card with primary color</div>,
  },
};
