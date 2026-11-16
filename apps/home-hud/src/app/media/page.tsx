import { MediaClient } from './MediaClient';
import {
  getHealth,
  getPorts,
  getPublicIp,
  getServices,
  getStatus,
} from './lib/gluetun-sync-api';
import { getHomeIp } from './lib/home-ip';
import { getGluetunSyncLogs, getMediaDiskSpace } from './lib/homelab-api';
import { getPodMap } from '../infra/cluster-map/lib/homelab-api';

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
  console.error(
    `Failed to load ${what} from a backing service:`,
    result.reason,
  );
  return null;
}

export default async function MediaPage() {
  const [
    ports,
    status,
    publicIp,
    services,
    syncHealthy,
    homeIp,
    diskSpace,
    podMap,
    logs,
  ] = await Promise.allSettled([
    getPorts(),
    getStatus(),
    getPublicIp(),
    getServices(),
    getHealth(),
    getHomeIp(),
    getMediaDiskSpace(),
    getPodMap('both'),
    getGluetunSyncLogs(),
  ]);

  return (
    <MediaClient
      ports={valueOrNull(ports, 'ports')}
      status={valueOrNull(status, 'status')}
      publicIp={valueOrNull(publicIp, 'public ip')}
      services={valueOrNull(services, 'service status')}
      syncHealthy={valueOrNull(syncHealthy, 'health') ?? false}
      homeIp={valueOrNull(homeIp, 'home ip')}
      diskSpace={valueOrNull(diskSpace, 'disk space')}
      serviceMapItems={
        valueOrNull(podMap, 'the cluster map')?.items.filter(
          (item) => item.namespace === 'media',
        ) ?? null
      }
      logLines={valueOrNull(logs, 'gluetun-sync logs')}
    />
  );
}
