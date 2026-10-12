'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  NavBar,
  NavItem,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@abbottland/fui-components';

const VIDEO_MENU_ITEMS = [
  { href: '/video', label: 'Home' },
  { href: '/video/jobs', label: 'Jobs' },
  { href: '/video/title-cards', label: 'Title Cards' },
  { href: '/video/file-renames', label: 'File Renames' },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const videoActive = pathname.startsWith('/video');
  const infraMapActive = pathname.startsWith('/infra-map');

  return (
    <div className="bg-neutral-900 px-6 pt-4">
      <NavBar>
        <NavItem as="a" href="/" active={pathname === '/'}>
          Home
        </NavItem>
        <NavItem as="a" href="/infra-map" active={infraMapActive}>
          Infra Map
        </NavItem>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger className="bg-transparent border-0 p-0 cursor-pointer outline-none">
            <NavItem active={videoActive || open}>Video</NavItem>
          </DropdownMenuTrigger>
          <DropdownMenuContent label="Video" align="start">
            {VIDEO_MENU_ITEMS.map((item) => (
              <DropdownMenuItem
                key={item.href}
                onSelect={() => router.push(item.href)}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </NavBar>
    </div>
  );
}
