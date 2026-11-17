import type { ServicesResult } from '../lib/gluetun-sync-api';
import { Row, Section } from './Section';

interface ServiceStatusProps {
  /** gluetun-sync's own `/healthz` answered 200. */
  syncHealthy: boolean;
  /** Null when gluetun-sync could not be reached, so its upstream checks are unknown. */
  services: ServicesResult | null;
}

function StatusRow({ label, up }: { label: string; up: boolean | null }) {
  return (
    <Row
      label={label}
      color={up === null ? undefined : up ? 'success' : 'error'}
    >
      {up === null ? '—' : up ? 'OK' : 'DOWN'}
    </Row>
  );
}

export function ServiceStatus({ syncHealthy, services }: ServiceStatusProps) {
  return (
    <Section
      title="Service Status"
      note="qbittorrent and gluetun are checked from gluetun-sync's perspective (its own pod), not from home-hud."
    >
      <StatusRow label="gluetun-sync healthz" up={syncHealthy} />
      <StatusRow label="qbittorrent" up={services?.qbittorrent ?? null} />
      <StatusRow label="gluetun" up={services?.gluetun ?? null} />
    </Section>
  );
}
