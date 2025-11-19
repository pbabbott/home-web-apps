import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { HomeIcon, PersonIcon, GearIcon } from '@radix-ui/react-icons';

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

export const AsAnchor: Story = {
  args: {
    as: 'a',
    href: '#',
    children: 'Link Item',
  },
};

export const WithIcon: Story = {
  args: {
    icon: HomeIcon,
    children: 'Home is where the heart is',
  },
};

export const WithIconAsAnchor: Story = {
  args: {
    as: 'a',
    href: '#',
    icon: PersonIcon,
    children: 'Profile',
  },
};

export const MultipleWithIcons: Story = {
  render: () => (
    <div className="flex flex-row">
      <NavItem icon={HomeIcon} showLeftLine={true} showRightLine={false}>
        Home
      </NavItem>
      <NavItem icon={PersonIcon} showLeftLine={true} showRightLine={false}>
        Profile
      </NavItem>
      <NavItem icon={GearIcon} showLeftLine={true} showRightLine={true}>
        Settings
      </NavItem>
    </div>
  ),
};
