import { MediaClient } from './MediaClient';
import { getPorts, type PortsResult } from './lib/gluetun-sync-api';

export const metadata = {
  title: 'Media | Home HUD',
};

// Ports come from the running gluetun-sync and must not be frozen at build time.
export const dynamic = 'force-dynamic';

export default async function MediaPage() {
  let ports: PortsResult | null = null;

  try {
    ports = await getPorts();
  } catch (err) {
    console.error('Failed to load ports from gluetun-sync:', err);
  }

  return <MediaClient ports={ports} />;
}
