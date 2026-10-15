'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Badge,
  type BadgeColor,
  OutlinedButton,
  Panel,
  Switch,
  Typography,
} from '@abbottland/fui-components';
import { AddHostModal } from './AddHostModal';
import { CpuChart } from './CpuChart';
import { DiskIoChart } from './DiskIoChart';
import { DiskSpaceTable } from './DiskSpaceTable';
import { EditHostModal } from './EditHostModal';
import { Host3DModel } from './Host3DModel';
import { MemoryChart } from './MemoryChart';
import { TemperatureChart } from './TemperatureChart';
import { formatBytes } from './lib/format-bytes';
import type {
  Host,
  HostCpuMetrics,
  HostDiskIoMetrics,
  HostDiskSpace,
  HostMemoryMetrics,
  HostStatus,
  HostTemperatureMetrics,
  HostType,
} from './lib/homelab-api';
import { isKnownModelSlug } from '../viz/models/registry';

const STATUS_BADGE_COLOR: Record<HostStatus, BadgeColor> = {
  online: 'success',
  offline: 'error',
  unknown: 'dark',
};

function formatPercent(ratio: number | null): string {
  return ratio === null ? '—' : `${Math.round(ratio * 100)}%`;
}

function buildUrl(hostType: HostType, hostId: string | null): string {
  const params = new URLSearchParams({ type: hostType });
  if (hostId) params.set('host', hostId);
  return `/infra/hosts?${params}`;
}

/** Used-ratio from the most recent point of each memory component series. */
function latestMemoryUsageRatio(
  memoryMetrics: HostMemoryMetrics | null,
): number | null {
  if (!memoryMetrics) return null;

  const latest = (component: string) => {
    const series = memoryMetrics.series.find((s) => s.component === component);
    return series?.points.at(-1)?.value;
  };

  const used = latest('used');
  const buffers = latest('buffers');
  const cached = latest('cached');
  const free = latest('free');

  if (
    used === undefined ||
    buffers === undefined ||
    cached === undefined ||
    free === undefined
  ) {
    return null;
  }

  const total = used + buffers + cached + free;
  return total > 0 ? used / total : null;
}

/** Combined read+written throughput across all devices, from the most recent point of each series. */
function latestDiskThroughputLabel(
  diskIoMetrics: HostDiskIoMetrics | null,
): string {
  if (!diskIoMetrics || diskIoMetrics.series.length === 0) return '—';

  const total = diskIoMetrics.series
    .filter((s) => s.component === 'read' || s.component === 'written')
    .reduce((sum, s) => sum + (s.points.at(-1)?.value ?? 0), 0);

  return `${formatBytes(total)}/s`;
}

/** Used% of the root ("/") mountpoint, the single most relevant number for the header badge. */
function rootDiskUsageRatio(diskSpace: HostDiskSpace | null): number | null {
  const root = diskSpace?.mountpoints.find((mp) => mp.mountpoint === '/');
  return root?.usedRatio ?? null;
}

/** Hottest sensor's current reading, the single most relevant number for the header badge. */
function latestMaxTemperatureLabel(
  temperatureMetrics: HostTemperatureMetrics | null,
): string {
  if (!temperatureMetrics || temperatureMetrics.series.length === 0) {
    return '—';
  }

  const latestValues = temperatureMetrics.series
    .map((s) => s.points.at(-1)?.value)
    .filter((value): value is number => value !== undefined);

  if (latestValues.length === 0) return '—';

  return `${Math.round(Math.max(...latestValues))}°C`;
}

function CpuMetricPanel({
  value,
  status,
  cpuMetrics,
}: {
  value: string;
  status?: HostStatus;
  cpuMetrics: HostCpuMetrics | null;
}) {
  return (
    <Panel color="default" className="flex flex-col gap-3 sm:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <Typography variant="small" className="text-neutral-400">
          CPU
        </Typography>
        <Badge color={status ? STATUS_BADGE_COLOR[status] : 'dark'}>
          {value}
        </Badge>
      </div>
      <CpuChart metrics={cpuMetrics} />
    </Panel>
  );
}

function MemoryMetricPanel({
  memoryMetrics,
}: {
  memoryMetrics: HostMemoryMetrics | null;
}) {
  return (
    <Panel color="default" className="flex flex-col gap-3 sm:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <Typography variant="small" className="text-neutral-400">
          Memory
        </Typography>
        <Badge color="dark">
          {formatPercent(latestMemoryUsageRatio(memoryMetrics))}
        </Badge>
      </div>
      <MemoryChart metrics={memoryMetrics} />
    </Panel>
  );
}

function DiskIoMetricPanel({
  diskIoMetrics,
}: {
  diskIoMetrics: HostDiskIoMetrics | null;
}) {
  return (
    <Panel color="default" className="flex flex-col gap-3 sm:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <Typography variant="small" className="text-neutral-400">
          Disk I/O
        </Typography>
        <Badge color="dark">{latestDiskThroughputLabel(diskIoMetrics)}</Badge>
      </div>
      <DiskIoChart metrics={diskIoMetrics} />
    </Panel>
  );
}

function DiskSpaceMetricPanel({
  diskSpace,
}: {
  diskSpace: HostDiskSpace | null;
}) {
  return (
    <Panel color="default" className="flex flex-col gap-3 sm:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <Typography variant="small" className="text-neutral-400">
          Disk Space
        </Typography>
        <Badge color="dark">
          {formatPercent(rootDiskUsageRatio(diskSpace))} used (/)
        </Badge>
      </div>
      <DiskSpaceTable diskSpace={diskSpace} />
    </Panel>
  );
}

function TemperatureMetricPanel({
  temperatureMetrics,
}: {
  temperatureMetrics: HostTemperatureMetrics | null;
}) {
  return (
    <Panel color="default" className="flex flex-col gap-3 sm:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <Typography variant="small" className="text-neutral-400">
          Temperature
        </Typography>
        <Badge color="dark">
          {latestMaxTemperatureLabel(temperatureMetrics)}
        </Badge>
      </div>
      <TemperatureChart metrics={temperatureMetrics} />
    </Panel>
  );
}

function HostListItem({
  host,
  active,
  onSelect,
}: {
  host: Host;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-2 border px-3 py-2 text-left transition-colors cursor-pointer ${
        active
          ? 'border-primary-500 bg-primary-900/40'
          : 'border-neutral-700 hover:border-neutral-500'
      }`}
    >
      <div className="flex flex-col gap-0.5">
        <Typography variant="body2">{host.name}</Typography>
        <Typography variant="caption" className="text-neutral-400">
          {host.ipAddress}
        </Typography>
      </div>
      <Badge color={STATUS_BADGE_COLOR[host.status]}>{host.status}</Badge>
    </button>
  );
}

function HostDetail({
  host,
  onEdit,
  cpuMetrics,
  memoryMetrics,
  diskIoMetrics,
  diskSpace,
  temperatureMetrics,
}: {
  host: Host;
  onEdit: () => void;
  cpuMetrics: HostCpuMetrics | null;
  memoryMetrics: HostMemoryMetrics | null;
  diskIoMetrics: HostDiskIoMetrics | null;
  diskSpace: HostDiskSpace | null;
  temperatureMetrics: HostTemperatureMetrics | null;
}) {
  return (
    <Panel color="default" className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <Typography variant="h5" component="h2" className="break-all">
          {host.name}
        </Typography>
        <div className="flex items-center gap-2">
          <OutlinedButton size="small" onClick={onEdit}>
            Edit
          </OutlinedButton>
          <Badge color={STATUS_BADGE_COLOR[host.status]}>{host.status}</Badge>
        </div>
      </div>

      <Typography variant="body2" className="text-neutral-400">
        {host.ipAddress}
        {host.instance ? ` · ${host.instance}` : ''}
      </Typography>

      {isKnownModelSlug(host.model3d) ? (
        <Host3DModel modelSlug={host.model3d as string} hostName={host.name} />
      ) : (
        <div className="flex h-[32rem] w-full items-center justify-center border border-neutral-700 bg-gradient-to-br from-neutral-900 to-neutral-700">
          <Typography variant="body2" className="text-neutral-500">
            No image yet
          </Typography>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CpuMetricPanel
          value={formatPercent(host.cpuUsageRatio)}
          cpuMetrics={cpuMetrics}
        />
        <MemoryMetricPanel memoryMetrics={memoryMetrics} />
        <DiskIoMetricPanel diskIoMetrics={diskIoMetrics} />
        <DiskSpaceMetricPanel diskSpace={diskSpace} />
        {host.hostType === 'physical' && (
          <TemperatureMetricPanel temperatureMetrics={temperatureMetrics} />
        )}
      </div>
    </Panel>
  );
}

interface HostsClientProps {
  hosts: Host[] | null;
  hostType: HostType;
  selectedHostId: string | null;
  cpuMetrics: HostCpuMetrics | null;
  memoryMetrics: HostMemoryMetrics | null;
  diskIoMetrics: HostDiskIoMetrics | null;
  diskSpace: HostDiskSpace | null;
  temperatureMetrics: HostTemperatureMetrics | null;
}

export function HostsClient({
  hosts,
  hostType,
  selectedHostId,
  cpuMetrics,
  memoryMetrics,
  diskIoMetrics,
  diskSpace,
  temperatureMetrics,
}: HostsClientProps) {
  const router = useRouter();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const selectedHost =
    hosts?.find((host) => host.id === selectedHostId) ?? null;

  function selectHostType(nextType: HostType) {
    router.push(buildUrl(nextType, null));
  }

  function selectHost(host: Host) {
    const nextId = selectedHostId === host.id ? null : host.id;
    router.push(buildUrl(hostType, nextId));
  }

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
      <Typography variant="h1" component="h1">
        Hosts
      </Typography>

      <div className="flex min-h-0 flex-col gap-6 lg:flex-row lg:items-stretch">
        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-96">
          <Panel color="default" className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Typography variant="small" className="text-neutral-400">
                  Physical
                </Typography>
                <Switch
                  checked={hostType === 'virtual'}
                  onCheckedChange={(checked) =>
                    selectHostType(checked ? 'virtual' : 'physical')
                  }
                />
                <Typography variant="small" className="text-neutral-400">
                  Virtual
                </Typography>
              </div>
            </div>

            <OutlinedButton size="small" onClick={() => setAddModalOpen(true)}>
              + Add Host
            </OutlinedButton>
          </Panel>

          <div className="flex flex-col gap-2">
            {hosts === null ? (
              <Typography variant="body2" className="text-error-400">
                Failed to load hosts from homelab-api.
              </Typography>
            ) : hosts.length === 0 ? (
              <Typography variant="body2" className="text-neutral-400">
                No {hostType} hosts yet.
              </Typography>
            ) : (
              hosts.map((host) => (
                <HostListItem
                  key={host.id}
                  host={host}
                  active={host.id === selectedHostId}
                  onSelect={() => selectHost(host)}
                />
              ))
            )}
          </div>
        </div>

        <div className="w-full">
          {selectedHost ? (
            <HostDetail
              // Forces a full unmount/remount per host instead of an
              // in-place prop diff: without this, the 4 echarts-backed
              // panels below (each with its own ResizeObserver + canvas)
              // get patched in place on every host switch, and fast
              // switching can race their dispose/init cycles against
              // React's own DOM patching, surfacing as a stray "Failed to
              // execute 'removeChild'" crash. Keying by host id makes
              // cleanup (disconnect + dispose) run to completion before
              // the next mount starts, so there's no shared DOM node left
              // for the two to race over.
              key={selectedHost.id}
              host={selectedHost}
              onEdit={() => setEditModalOpen(true)}
              cpuMetrics={cpuMetrics}
              memoryMetrics={memoryMetrics}
              diskIoMetrics={diskIoMetrics}
              diskSpace={diskSpace}
              temperatureMetrics={temperatureMetrics}
            />
          ) : (
            <Panel color="default" className="flex h-full flex-col gap-2">
              <Typography variant="h5" component="h2">
                Host Detail
              </Typography>
              <Typography variant="body2" className="text-neutral-400">
                Select a host to see details.
              </Typography>
            </Panel>
          )}
        </div>
      </div>

      <AddHostModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        defaultHostType={hostType}
        onCreated={() => router.refresh()}
      />

      {selectedHost && (
        <EditHostModal
          host={selectedHost}
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          onUpdated={() => router.refresh()}
          onDeleted={() => {
            router.push(buildUrl(hostType, null));
            router.refresh();
          }}
        />
      )}
    </main>
  );
}
