'use client';

import { useEffect, useState, type ComponentProps } from 'react';
import { Typography } from '@abbottland/fui-components';

// Set only when developing through the Coder code-server proxy (see proxy-dev).
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * Shows what is running: the pod's IMAGE_TAG, read at runtime from
 * GET /api/version (never baked into the bundle at build time). Renders `dev`
 * until the request completes, or if it fails or the tag is unset, so the
 * server-rendered HTML is identical for every build.
 */
export function BuildInfo({
  variant = 'caption',
  className,
}: {
  variant?: ComponentProps<typeof Typography>['variant'];
  className?: string;
}) {
  const [label, setLabel] = useState('dev');

  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE_PATH}/api/version`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((info) => {
        if (!cancelled && typeof info?.label === 'string') setLabel(info.label);
      })
      .catch(() => {
        // Keep showing `dev`: the version is informational only.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Typography variant={variant} className={className}>
      {label}
    </Typography>
  );
}
