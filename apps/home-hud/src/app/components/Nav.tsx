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
  { href: '/video', label: 'Dashboard' },
  { href: '/video/jobs', label: 'Jobs' },
  { href: '/video/title-cards', label: 'Title Cards' },
  { href: '/video/file-renames', label: 'File Renames' },
];

const EXODUS_MENU_ITEMS = [
  { href: '/exodus/sources', label: 'Sources' },
  { href: '/exodus/jobs', label: 'Discovery Jobs' },
  { href: '/exodus/inventory', label: 'Inventory' },
  { href: '/exodus/rules', label: 'Exclusion Rules' },
  { href: '/exodus/audit', label: 'Audit Log' },
  { href: '/exodus/architecture', label: 'Architecture' },
];

const INFRA_MENU_ITEMS = [
  { href: '/infra/hosts', label: 'Hosts' },
  { href: '/infra/cluster-map', label: 'Cluster Map' },
  { href: '/infra/viz', label: '3D Model Viewer' },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [videoOpen, setVideoOpen] = useState(false);
  const [infraOpen, setInfraOpen] = useState(false);
  const [exodusOpen, setExodusOpen] = useState(false);

  const videoActive = pathname.startsWith('/video');
  const infraActive = pathname.startsWith('/infra');
  const exodusActive = pathname.startsWith('/exodus');

  return (
    <div className="bg-neutral-900 px-6 pt-4">
      <NavBar>
        <NavItem as="a" href="/" active={pathname === '/'}>
          Home
        </NavItem>
        <DropdownMenu open={infraOpen} onOpenChange={setInfraOpen}>
          <DropdownMenuTrigger className="bg-transparent border-0 p-0 cursor-pointer outline-none">
            <NavItem active={infraActive || infraOpen}>Infra</NavItem>
          </DropdownMenuTrigger>
          <DropdownMenuContent label="Infra" align="start">
            {INFRA_MENU_ITEMS.map((item) => (
              <DropdownMenuItem
                key={item.href}
                onSelect={() => router.push(item.href)}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu open={exodusOpen} onOpenChange={setExodusOpen}>
          <DropdownMenuTrigger className="bg-transparent border-0 p-0 cursor-pointer outline-none">
            <NavItem active={exodusActive || exodusOpen}>Exodus</NavItem>
          </DropdownMenuTrigger>
          <DropdownMenuContent label="Exodus" align="start">
            {EXODUS_MENU_ITEMS.map((item) => (
              <DropdownMenuItem
                key={item.href}
                onSelect={() => router.push(item.href)}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu open={videoOpen} onOpenChange={setVideoOpen}>
          <DropdownMenuTrigger className="bg-transparent border-0 p-0 cursor-pointer outline-none">
            <NavItem active={videoActive || videoOpen}>Video</NavItem>
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
