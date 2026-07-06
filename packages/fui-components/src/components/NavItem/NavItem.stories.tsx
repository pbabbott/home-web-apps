import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { CubeIcon, OpenInNewWindowIcon } from '@radix-ui/react-icons';

import { NavItem } from './NavItem';

const meta = {
  title: 'Components/NavItem',
  component: NavItem,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    as: {
      control: 'select',
      options: ['div', 'a'],
      description: 'The element or component to render as',
    },
    children: {
      control: 'text',
      description: 'The content of the nav item',
    },
    icon: {
      control: false,
      description: 'An icon component from @radix-ui/react-icons',
    },
    rightIcon: {
      control: false,
      description:
        'An icon component from @radix-ui/react-icons, rendered after the label',
    },
    showLeftLine: {
      control: 'boolean',
      description: 'Whether to show the left LineWithCircle',
    },
    showRightLine: {
      control: 'boolean',
      description: 'Whether to show the right LineWithCircle',
    },
    onClick: { action: 'clicked' },
  },
  args: {
    onClick: fn(),
    children: 'Nav Item',
  },
} satisfies Meta<typeof NavItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: CubeIcon,
    children: 'Abbottland',
  },
};

export const Active: Story = {
  args: {
    icon: CubeIcon,
    children: 'Abbottland',
    active: true,
  },
};

export const WithoutLines: Story = {
  args: {
    icon: CubeIcon,
    children: 'Abbottland',
    showLeftLine: false,
    showRightLine: false,
  },
};

export const WithRightIcon: Story = {
  args: {
    icon: CubeIcon,
    rightIcon: OpenInNewWindowIcon,
    children: 'Abbottland',
  },
};
