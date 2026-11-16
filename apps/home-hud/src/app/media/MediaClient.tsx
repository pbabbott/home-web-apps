'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Comparator, Typography } from '@abbottland/fui-components';
import type { PortsResult } from './lib/gluetun-sync-api';
import { syncPorts, type SyncPortsResult } from './lib/actions';

interface MediaClientProps {
  ports: PortsResult | null;
}

function toPort(port: string | null | undefined): string | null {
  return port && port !== '0' ? port : null;
}

export function MediaClient({ ports }: MediaClientProps) {
  // Port "0" means "no port" (gluetun has no forwarded port yet, qBittorrent is
  // on a random port), so it must not count as a match.
  const gluetun = toPort(ports?.gluetunPort);
  const qbit = toPort(ports?.qbitTorrentPort);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [syncResult, setSyncResult] = useState<SyncPortsResult | null>(null);

  const handleSync = () => {
    startTransition(async () => {
      setSyncResult(await syncPorts());
      router.refresh();
    });
  };

  const inSync = gluetun !== null && qbit !== null && gluetun === qbit;

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
        <Typography variant="h2" component="h2">
          VPN Port Sync
        </Typography>
        <section className="flex flex-col gap-4">
          <Typography variant="h3" component="h3">
            Ports
          </Typography>
          {ports === null ? (
            <Typography variant="body2" className="text-neutral-400">
              Port status unavailable.
            </Typography>
          ) : (
            <Comparator
              valueA={gluetun ?? 'unknown'}
              valueB={qbit ?? 'unknown'}
              captionA="Gluetun"
              captionB="qBittorrent"
              label={inSync ? 'Synchronized' : 'Out of sync'}
              inSync={inSync}
              active
              className="pt-8"
            />
          )}
          <div className="flex items-center gap-4">
            <Button size="small" onClick={handleSync} disabled={pending}>
              {pending ? 'Syncing…' : 'Sync ports'}
            </Button>
            {syncResult && (
              <Typography
                variant="body2"
                className={
                  syncResult.success ? 'text-neutral-400' : 'text-error-400'
                }
              >
                {syncResult.message}
              </Typography>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
