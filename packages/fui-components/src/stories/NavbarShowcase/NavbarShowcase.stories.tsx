import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CubeIcon,
  FileTextIcon,
  CardStackPlusIcon,
} from '@radix-ui/react-icons';

import { NavBar } from '../../components/NavBar/NavBar';
import { NavItem } from '../../components/NavItem/NavItem';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '../../components/DropdownMenu/DropdownMenu';
import { DirectoryMenuItems } from '../shared/DirectoryMenuItems';

const meta: Meta = {
  title: 'Showcase/Navbar',
};
export default meta;
type Story = StoryObj<typeof meta>;

const NavbarWithDropdown = () => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="fixed top-0 left-0 right-0 z-30 bg-neutral-900/30 backdrop-blur-sm border-b border-neutral-300/10">
      <div className="px-4 pt-2 flex justify-between items-center">
        <NavBar>
          <NavItem icon={CubeIcon} showLeftLine={true} showRightLine={false}>
            Abbottland.io
          </NavItem>
          <NavItem icon={FileTextIcon}>Blog</NavItem>
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger className="bg-transparent border-0 p-0 cursor-pointer outline-none">
              <NavItem icon={CardStackPlusIcon} active={open}>
                Directory
              </NavItem>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              label="Interface Directory"
              showClose
              align="end"
            >
              <DirectoryMenuItems />
            </DropdownMenuContent>
          </DropdownMenu>
        </NavBar>
      </div>
    </div>
  );
};

export const InsideFixedHeader: Story = {
  render: () => <NavbarWithDropdown />,
};
