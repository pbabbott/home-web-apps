'use client';
import {
  NavBar,
  NavItem,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@abbottland/fui-components';
import {
  CubeIcon,
  FileTextIcon,
  CardStackPlusIcon,
  CardStackMinusIcon,
  SectionIcon,
  LayersIcon,
  OpenInNewWindowIcon,
} from '@radix-ui/react-icons';
import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function StickyHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed top-0 left-0 right-0 z-30 bg-neutral-900/30 backdrop-blur-sm border-b border-neutral-300/10">
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
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger
              className="bg-transparent border-0 p-0 cursor-pointer outline-none"
              suppressHydrationWarning
            >
              <NavItem
                icon={open ? CardStackMinusIcon : CardStackPlusIcon}
                active={open}
              >
                Directory
              </NavItem>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              label="Interface Directory"
              showClose
              align="end"
            >
              <DropdownMenuItem
                icon={SectionIcon}
                onSelect={() => router.push('/series')}
              >
                Series
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={LayersIcon}
                onSelect={() => router.push('/system-architecture')}
              >
                System Architecture
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={CubeIcon}
                rightIcon={OpenInNewWindowIcon}
                onSelect={() =>
                  window.open('https://fui-components.abbottland.io/', '_blank')
                }
              >
                FUI Components
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </NavBar>
      </div>
    </div>
  );
}
