'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { EdgeDrawer, Switch, Typography } from '@abbottland/fui-components';
import { useAnimationsContext } from '@/context/Animations.Context';
import {
  useReaderPreferences,
  setHighlightAiEnabled,
} from '@/context/ReaderPreferences.Context';

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
    </EdgeDrawer>
  );
}
