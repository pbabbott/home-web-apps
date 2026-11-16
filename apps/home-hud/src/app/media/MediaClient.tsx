'use client';

import { Typography } from '@abbottland/fui-components';
import type {
  PortsResult,
  PublicIp,
  ServicesResult,
  SyncStatus,
} from './lib/gluetun-sync-api';
import type { PodMapItem } from '../infra/cluster-map/lib/homelab-api';
import type { MediaDiskSpace } from './lib/homelab-api';
import { DiskSpace } from './components/DiskSpace';
import { GluetunSyncLogs } from './components/GluetunSyncLogs';
import { ServiceMap } from './components/ServiceMap';
import { Placeholder } from './components/Placeholder';
import { VpnPortSync } from './VpnPortSync';

interface MediaClientProps {
  ports: PortsResult | null;
  status: SyncStatus | null;
  publicIp: PublicIp | null;
  services: ServicesResult | null;
  syncHealthy: boolean;
  homeIp: string | null;
  diskSpace: MediaDiskSpace | null;
  serviceMapItems: PodMapItem[] | null;
  logLines: string[] | null;
}

export function MediaClient({
  diskSpace,
  serviceMapItems,
  logLines,
  ...vpn
}: MediaClientProps) {
  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-1 gap-10 p-6 lg:grid-cols-3">
        <div className="flex flex-col gap-10">
          <VpnPortSync {...vpn} />
          <GluetunSyncLogs initialLines={logLines} />
        </div>

        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-4">
            <Typography variant="h2" component="h2">
              Disk Space
            </Typography>
            <DiskSpace diskSpace={diskSpace} />
          </section>
          <section className="flex flex-col gap-4">
            <Typography variant="h2" component="h2">
              Service Statuses
            </Typography>
            <ServiceMap items={serviceMapItems} />
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <Typography variant="h2" component="h2">
            Downloads
          </Typography>
          <Placeholder title="Summary" />
          <Placeholder title="qBittorrent Stats" />
          <Placeholder title="Sonarr Stats" />
          <Placeholder title="Radarr Stats" />
          <Placeholder title="Plex Stats" />
        </div>
      </div>
    </main>
  );
}
