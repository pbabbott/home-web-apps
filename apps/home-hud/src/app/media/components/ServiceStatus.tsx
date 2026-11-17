import { StatusIndicator, Typography } from '@abbottland/fui-components';
import type { ServicesResult } from '../lib/gluetun-sync-api';

interface ServiceStatusProps {
  /** gluetun-sync's own `/healthz` answered 200. */
  syncHealthy: boolean;
  /** Null when gluetun-sync could not be reached, so its upstream checks are unknown. */
  services: ServicesResult | null;
}

function StatusRow({ label, up }: { label: string; up: boolean | null }) {
  // Unknown (null) is neutral, not red: we don't know it's down.
  return (
    <StatusIndicator
      color={up === null ? 'neutral' : up ? 'success' : 'error'}
      aria-label={`${label}: ${up === null ? 'unknown' : up ? 'OK' : 'down'}`}
    >
      {label}
    </StatusIndicator>
  );
}

export function ServiceStatus({ syncHealthy, services }: ServiceStatusProps) {
  return (
    <section className="flex flex-col gap-3">
      <Typography variant="h3" component="h3">
        Service Status
      </Typography>
      <Typography variant="small" className="text-neutral-400">
        qbittorrent and gluetun are checked from gluetun-sync&apos;s perspective
        (its own pod), not from home-hud.
      </Typography>
      <ul className="m-0 flex max-w-md list-none flex-col gap-1 p-0">
        <StatusRow label="gluetun-sync healthz" up={syncHealthy} />
        <StatusRow label="qbittorrent" up={services?.qbittorrent ?? null} />
        <StatusRow label="gluetun" up={services?.gluetun ?? null} />
      </ul>
    </section>
  );
}
