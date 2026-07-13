'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  HexagonalBackground,
  Typography,
  TransparentPanel,
} from '@abbottland/fui-components';
import { HomeIcon, ReloadIcon } from '@radix-ui/react-icons';

// Sparks run briefly then lock in place — a "system halted" freeze-frame rather
// than a fully static background.
const FREEZE_DELAY_MS = 6000;

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [sparksFrozen, setSparksFrozen] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    const timer = setTimeout(() => setSparksFrozen(true), FREEZE_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full h-dvh overflow-hidden">
      <div className="absolute inset-0">
        <HexagonalBackground theme="error" sparksFrozen={sparksFrozen} />
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
            Error
          </Typography>
          <Typography variant="h5" component="h2" className="mb-4">
            System Fault
          </Typography>
          <Typography variant="body1" className="mb-8 text-neutral-300">
            Something went wrong while rendering this page. You can retry the
            operation or return to safety.
          </Typography>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              onClick={reset}
              variant="contained"
              color="primary"
              className="inline-flex items-center gap-2"
            >
              <ReloadIcon /> Try Again
            </Button>
            <Button
              component={Link}
              href="/"
              variant="contained"
              color="secondary"
              className="inline-flex items-center gap-2"
            >
              <HomeIcon /> Return Home
            </Button>
          </div>
        </TransparentPanel>
      </div>
    </div>
  );
}
