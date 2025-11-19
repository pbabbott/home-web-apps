'use client';
import { NavBar, NavItem } from '@abbottland/fui-components';
import { CubeIcon } from '@radix-ui/react-icons';

export default function StickyHeader() {
  return (
    <div className="fixed top-0 left-0 right-0 z-30 bg-secondary-900/30 backdrop-blur-sm border-b border-neutral-300/10">
      <div className="px-4 pt-2">
        <div className="flex justify-between items-center">
          <NavBar>
            <NavItem
              icon={CubeIcon}
              as="a"
              href="/"
              showLeftLine={true}
              showRightLine={false}
            >
              Abbottland.io
            </NavItem>
            <NavItem as="a" href="/blog">
              Blog
            </NavItem>
          </NavBar>
        </div>
      </div>
    </div>
  );
}
