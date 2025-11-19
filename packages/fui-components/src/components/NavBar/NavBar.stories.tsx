import type { Meta, StoryObj } from '@storybook/react-vite';
import { PersonIcon, GearIcon, CubeIcon } from '@radix-ui/react-icons';

import { NavBar } from './NavBar';
import { NavItem } from '../NavItem/NavItem';

const meta = {
  title: 'Components/NavBar',
  component: NavBar,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    children: {
      control: 'text',
      description: 'The content of the navbar',
    },
  },
  args: {
    children: 'NavBar',
  },
} satisfies Meta<typeof NavBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <NavBar>
      <NavItem icon={CubeIcon} showLeftLine={true} showRightLine={false}>
        Abbottland
      </NavItem>
      <NavItem icon={PersonIcon} showLeftLine={true} showRightLine={false}>
        Profile
      </NavItem>
      <NavItem icon={GearIcon} showLeftLine={true} showRightLine={true}>
        Settings
      </NavItem>
    </NavBar>
  ),
};
