'use client';
import { NavBar, NavItem } from '@abbottland/fui-components';
import { CubeIcon, FileTextIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface StickyHeaderProps {
  fixed?: boolean;
}

export default function StickyHeader({}: StickyHeaderProps) {
  const pathname = usePathname();

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-30 bg-neutral-900/30 backdrop-blur-sm border-b border-neutral-300/10`}
    >
      <div className="px-4 pt-2 flex justify-between items-center">
        <NavBar>
          <NavItem
            icon={CubeIcon}
            as={Link}
            href="/"
            active={pathname === '/'}
            showLeftLine={true}
            showRightLine={false}
          >
            Abbottland.io
          </NavItem>
          <NavItem
            as={Link}
            href="/blog"
            icon={FileTextIcon}
            active={pathname === '/blog'}
          >
            Blog
          </NavItem>
        </NavBar>
      </div>
    </div>
  );
}
