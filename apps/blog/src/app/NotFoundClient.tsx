'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  HexagonalBackground,
  Typography,
  TransparentPanel,
} from '@abbottland/fui-components';
import { HomeIcon, ReaderIcon } from '@radix-ui/react-icons';

// Sparks run briefly then lock in place — a "system halted" freeze-frame rather
// than a fully static background.
const FREEZE_DELAY_MS = 6000;

export default function NotFoundClient() {
  const [sparksFrozen, setSparksFrozen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSparksFrozen(true), FREEZE_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full h-dvh overflow-hidden">
      <div className="absolute inset-0">
        <HexagonalBackground theme="ice" sparksFrozen={sparksFrozen} />
      </div>

      <div className="relative z-10 flex h-full items-center justify-center px-4">
        <TransparentPanel
          color="dark"
          className="max-w-md text-center py-10 px-8"
        >
          <Typography
            variant="h1"
            component="h1"
            className="mb-2 tracking-[.15em]"
          >
            404
          </Typography>
          <Typography variant="h5" component="h2" className="mb-4">
            Signal Lost
          </Typography>
          <Typography variant="body1" className="mb-8 text-neutral-300">
            The route you requested does not exist in this system. Recalibrating
            navigation...
          </Typography>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              component={Link}
              href="/"
              variant="contained"
              color="primary"
              className="inline-flex items-center gap-2"
            >
              <HomeIcon /> Return Home
            </Button>
            <Button
              component={Link}
              href="/blog"
              variant="contained"
              color="secondary"
              className="inline-flex items-center gap-2"
            >
              <ReaderIcon /> Read Blog
            </Button>
          </div>
        </TransparentPanel>
      </div>
    </div>
  );
}
