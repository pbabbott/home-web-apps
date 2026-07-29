'use client';

import { usePathname } from 'next/navigation';
import { NavBar, NavItem } from '@abbottland/fui-components';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/jobs', label: 'Video Jobs' },
  { href: '/title-cards', label: 'Title Cards' },
  { href: '/file-renames', label: 'File Renames' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <div className="bg-neutral-900 px-6 pt-4">
      <NavBar>
        {NAV_LINKS.map((link) => (
          <NavItem
            key={link.href}
            as="a"
            href={link.href}
            active={pathname === link.href}
          >
            {link.label}
          </NavItem>
        ))}
      </NavBar>
    </div>
  );
}
