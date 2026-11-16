import { MediaClient } from './MediaClient';
import {
  getHealth,
  getPorts,
  getPublicIp,
  getServices,
  getStatus,
} from './lib/gluetun-sync-api';
import { getHomeIp } from './lib/home-ip';

export const metadata = {
  title: 'Media | Home HUD',
};

// Everything here comes from running services and must not be frozen at build time.
export const dynamic = 'force-dynamic';

/** The value of a settled promise, or null (logged) so one failing source only blanks its own section. */
function valueOrNull<T>(
  result: PromiseSettledResult<T>,
  what: string,
): T | null {
  if (result.status === 'fulfilled') return result.value;
  console.error(`Failed to load ${what} from gluetun-sync:`, result.reason);
  return null;
}

export default async function MediaPage() {
  const [ports, status, publicIp, services, syncHealthy, homeIp] =
    await Promise.allSettled([
      getPorts(),
      getStatus(),
      getPublicIp(),
      getServices(),
      getHealth(),
      getHomeIp(),
    ]);

  return (
    <MediaClient
      ports={valueOrNull(ports, 'ports')}
      status={valueOrNull(status, 'status')}
      publicIp={valueOrNull(publicIp, 'public ip')}
      services={valueOrNull(services, 'service status')}
      syncHealthy={valueOrNull(syncHealthy, 'health') ?? false}
      homeIp={valueOrNull(homeIp, 'home ip')}
    />
  );
}
