'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { EdgeDrawer, Switch, Typography } from '@abbottland/fui-components';
import { CalendarIcon, ClockIcon } from '@radix-ui/react-icons';
import { useAnimationsContext } from '@/context/Animations.Context';
import {
  useReaderPreferences,
  setHighlightAiEnabled,
} from '@/context/ReaderPreferences.Context';
import { useBlogPostStats } from '@/context/BlogPostStats.Context';

// Matches the id on PromiseSection (apps/blog/src/app/(home)/PromiseSection/PromiseSection.tsx).
const HOME_REVEAL_TARGET_ID = 'abbottland-promise';

/**
 * Mounted once, site-wide, in the root layout. Wires the generic
 * `EdgeDrawer`/`Switch` from fui-components to the app's persisted reader
 * preferences. Additional reader tools (issue #136 lists font scaling,
 * reduced motion, etc. as future candidates) get their own row here
 * without touching the drawer itself.
 *
 * On the homepage the drawer stays hidden (the landing/terminal sections
 * own the viewport) until the reader scrolls down to the Promise section;
 * every other route shows it immediately.
 */
export default function ReaderToolsDrawer() {
  const [open, setOpen] = useState(false);
  const { highlightAiEnabled } = useReaderPreferences();
  const { animationsEnabled } = useAnimationsContext();
  const { stats } = useBlogPostStats();
  const pathname = usePathname();
  const isHome = pathname === '/';
  const [homeRevealTarget, setHomeRevealTarget] = useState(false);

  useEffect(() => {
    if (!isHome || homeRevealTarget) return;
    const target = document.getElementById(HOME_REVEAL_TARGET_ID);
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHomeRevealTarget(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [isHome, homeRevealTarget]);

  if (isHome && !homeRevealTarget) return null;

  return (
    <EdgeDrawer
      title="Reader Tools"
      open={open}
      onOpenChange={setOpen}
      animated={animationsEnabled}
    >
      <div className="flex items-center justify-between gap-4">
        <Typography
          variant="body2"
          component="label"
          htmlFor="highlight-ai-switch"
        >
          Highlight AI Generated Text
        </Typography>
        <Switch
          id="highlight-ai-switch"
          checked={highlightAiEnabled}
          onCheckedChange={(checked: boolean) => setHighlightAiEnabled(checked)}
        />
      </div>
      {stats && (
        <div className="flex flex-col gap-2 text-neutral-400 text-sm">
          <div className="flex items-center gap-2">
            <CalendarIcon width={16} height={16} className="text-neutral-400" />
            <time dateTime={stats.date}>{stats.date}</time>
          </div>
          <div className="flex items-center gap-2">
            <ClockIcon width={16} height={16} className="text-neutral-400" />
            <Typography
              variant="body2"
              component="span"
              className="text-neutral-400"
            >
              {stats.readTime}
            </Typography>
          </div>
        </div>
      )}
    </EdgeDrawer>
  );
}
