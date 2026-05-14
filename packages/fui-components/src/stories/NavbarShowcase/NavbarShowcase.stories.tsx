import type { Meta, StoryObj } from '@storybook/react-vite';

import { NavBar } from '../../components/NavBar/NavBar';
import { NavItem } from '../../components/NavItem/NavItem';
import { CubeIcon } from '@radix-ui/react-icons';

import { FileTextIcon } from '@radix-ui/react-icons';

const meta: Meta = {
  title: 'Showcase/Navbar',
};
export default meta;
type Story = StoryObj<typeof meta>;

export const InsideFixedHeader: Story = {
  render: () => (
    <div className="fixed top-0 left-0 right-0 z-30 bg-neutral-900/30 backdrop-blur-sm border-b border-neutral-300/10">
      <div className="px-4 pt-2 flex justify-between items-center">
        <NavBar>
          <NavItem icon={CubeIcon} showLeftLine={true} showRightLine={false}>
            Abbottland.io
          </NavItem>
          <NavItem icon={FileTextIcon}>Blog</NavItem>
        </NavBar>
      </div>
    </div>
  ),
};
