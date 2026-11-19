'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  ConnectedNav,
  type ConnectedNavItem,
} from '@abbottland/fui-components';

// Section ids are the section's path prefix; leaf items navigate on click,
// sections reveal their subnav (whose items are full hrefs) instead.
const NAV_ITEMS: ConnectedNavItem[] = [
  { id: '/', label: 'Home' },
  {
    id: '/infra',
    label: 'Infra',
    children: [
      { id: '/infra/hosts', label: 'Hosts' },
      { id: '/infra/cluster-map', label: 'Cluster Map' },
      { id: '/infra/viz', label: '3D Model Viewer' },
    ],
  },
  {
    id: '/exodus',
    label: 'Exodus',
    children: [
      { id: '/exodus/sources', label: 'Sources' },
      { id: '/exodus/inventory', label: 'Inventory' },
      { id: '/exodus/backup', label: 'Backup' },
      { id: '/exodus/rules', label: 'Exclusion Rules' },
      { id: '/exodus/audit', label: 'Audit Log' },
      { id: '/exodus/architecture', label: 'Architecture' },
    ],
  },
  {
    id: '/video',
    label: 'Video',
    children: [
      { id: '/video', label: 'Dashboard' },
      { id: '/video/jobs', label: 'Jobs' },
      { id: '/video/title-cards', label: 'Title Cards' },
      { id: '/video/file-renames', label: 'File Renames' },
    ],
  },
  { id: '/media', label: 'Media' },
];

const isUnder = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** The top-level item owning this path ('/' only matches exactly). */
function sectionFor(pathname: string): string {
  const match = NAV_ITEMS.find((i) => i.id !== '/' && isUnder(pathname, i.id));
  return match?.id ?? '/';
}

/** The longest subnav href matching this path, or '' when none does. */
function subItemFor(pathname: string): string {
  const children =
    NAV_ITEMS.find((i) => i.id === sectionFor(pathname))?.children ?? [];
  return (
    children
      .filter((c) => isUnder(pathname, c.id))
      .sort((a, b) => b.id.length - a.id.length)[0]?.id ?? ''
  );
}

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  const activeSection = sectionFor(pathname);
  // The section whose subnav is showing. Clicking a section previews it
  // without navigating; it snaps back to the current page's section whenever
  // the route changes.
  const [section, setSection] = useState(activeSection);
  const [seenSection, setSeenSection] = useState(activeSection);
  if (seenSection !== activeSection) {
    setSeenSection(activeSection);
    setSection(activeSection);
  }

  return (
    <div className="bg-neutral-900 px-6 pt-4">
      <ConnectedNav
        items={NAV_ITEMS}
        value={section}
        onValueChange={(id) => {
          setSection(id);
          const item = NAV_ITEMS.find((i) => i.id === id);
          if (!item?.children) router.push(id);
        }}
        subValue={section === activeSection ? subItemFor(pathname) : ''}
        onSubValueChange={(href) => router.push(href)}
      />
    </div>
  );
}
