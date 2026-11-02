'use client';

import { Typography } from '@abbottland/fui-components';

/** Client component because fui-components can't be imported from a Server Component. */
export function BackupLoadError({ what }: { what: string }) {
  return (
    <main className="bg-neutral-800 p-8">
      <Typography variant="body2" className="text-error-400">
        Failed to load {what} from homelab-api.
      </Typography>
    </main>
  );
}
