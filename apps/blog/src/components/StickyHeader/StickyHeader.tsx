'use client';
import {
  NavBar,
  NavItem,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@abbottland/fui-components';
import { navigate } from '@/lib/navigate';
import {
  CubeIcon,
  FileTextIcon,
  CardStackPlusIcon,
  CardStackMinusIcon,
  SectionIcon,
  LayersIcon,
  Share1Icon,
  OpenInNewWindowIcon,
} from '@radix-ui/react-icons';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type OverflowBreakpoint = 'sm' | 'md' | 'lg' | 'xl';

interface NavOverflowItem {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string;
  external?: boolean;
}

// Single source of truth for both the navbar and Directory dropdown: order
// here is the left-to-right display order in both places, and also the
// collapse priority — the last item is the first to fold into the dropdown
// as the screen shrinks (right-to-left collapse), matched to
// OVERFLOW_BREAKPOINTS below by index.
const NAV_OVERFLOW_ITEMS: NavOverflowItem[] = [
  {
    key: 'system-architecture',
    label: 'System Architecture',
    icon: LayersIcon,
    href: '/system-architecture',
  },
  {
    key: 'series',
    label: 'Series',
    icon: SectionIcon,
    href: '/series',
  },
  {
    key: 'fui-components',
    label: 'FUI Components',
    icon: CubeIcon,
    href: 'https://fui-components.abbottland.io/',
    external: true,
  },
  {
    key: 'diagram-maker',
    label: 'Diagram Maker',
    icon: Share1Icon,
    href: 'https://diagram-maker.abbottland.io',
    external: true,
  },
];

// Ascending breakpoints, one per NAV_OVERFLOW_ITEMS entry by index: the
// item at index 0 promotes into the navbar first (smallest screen) and is
// the last to fold back into the dropdown; the last item promotes last
// (largest screen only) and is the first to fold back in.
const OVERFLOW_BREAKPOINTS: OverflowBreakpoint[] = ['sm', 'md', 'lg', 'xl'];

const BREAKPOINT_MIN_WIDTH_PX: Record<OverflowBreakpoint, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

// Visible in the navbar from `breakpoint` upward.
const NAV_VISIBLE_CLASS: Record<OverflowBreakpoint, string> = {
  sm: 'hidden sm:block',
  md: 'hidden md:block',
  lg: 'hidden lg:block',
  xl: 'hidden xl:block',
};

// Hidden from the dropdown from `breakpoint` upward (inverse of the above).
const DROPDOWN_HIDDEN_CLASS: Record<OverflowBreakpoint, string> = {
  sm: 'sm:hidden',
  md: 'md:hidden',
  lg: 'lg:hidden',
  xl: 'xl:hidden',
};

const lastBreakpoint = OVERFLOW_BREAKPOINTS[OVERFLOW_BREAKPOINTS.length - 1];
// Once the last overflow item promotes into the navbar, the dropdown is
// empty, so the trigger disappears on the same breakpoint.
const DROPDOWN_TRIGGER_HIDDEN_CLASS = DROPDOWN_HIDDEN_CLASS[lastBreakpoint];
const DROPDOWN_EMPTY_QUERY = `(min-width: ${BREAKPOINT_MIN_WIDTH_PX[lastBreakpoint]}px)`;

export default function StickyHeader() {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);

  // Force-close the dropdown if a resize crosses the breakpoint where it
  // empties out, so it can't stay open with nothing left inside it.
  useEffect(() => {
    const mql = window.matchMedia(DROPDOWN_EMPTY_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return (
    <div
      id="site-header"
      className="fixed top-0 left-0 right-0 z-30 bg-neutral-900/30 backdrop-blur-sm border-b border-neutral-300/10"
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
          {NAV_OVERFLOW_ITEMS.map((item, index) =>
            item.external ? (
              <NavItem
                key={item.key}
                as="a"
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                icon={item.icon}
                rightIcon={OpenInNewWindowIcon}
                className={NAV_VISIBLE_CLASS[OVERFLOW_BREAKPOINTS[index]]}
              >
                {item.label}
              </NavItem>
            ) : (
              <NavItem
                key={item.key}
                as={Link}
                href={item.href}
                icon={item.icon}
                active={pathname === item.href}
                className={NAV_VISIBLE_CLASS[OVERFLOW_BREAKPOINTS[index]]}
              >
                {item.label}
              </NavItem>
            ),
          )}
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger
              className={`bg-transparent border-0 p-0 cursor-pointer outline-none ${DROPDOWN_TRIGGER_HIDDEN_CLASS}`}
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
              {NAV_OVERFLOW_ITEMS.map((item, index) =>
                item.external ? (
                  <DropdownMenuItem
                    key={item.key}
                    icon={item.icon}
                    rightIcon={OpenInNewWindowIcon}
                    onSelect={() => window.open(item.href, '_blank')}
                    className={
                      DROPDOWN_HIDDEN_CLASS[OVERFLOW_BREAKPOINTS[index]]
                    }
                  >
                    {item.label}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    key={item.key}
                    icon={item.icon}
                    onSelect={() => navigate(item.href)}
                    className={
                      DROPDOWN_HIDDEN_CLASS[OVERFLOW_BREAKPOINTS[index]]
                    }
                  >
                    {item.label}
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </NavBar>
      </div>
    </div>
  );
}
