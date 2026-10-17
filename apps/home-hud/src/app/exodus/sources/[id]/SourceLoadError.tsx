'use client';

import { Typography } from '@abbottland/fui-components';

/**
 * Client component because fui-components' bundle uses hooks and can't be
 * imported from a Server Component (the detail page itself is one).
 */
export function SourceLoadError() {
  return (
    <main className="bg-neutral-800 p-8">
      <Typography variant="body2" className="text-error-400">
        Failed to load backup sources from homelab-api.
      </Typography>
    </main>
  );
}
