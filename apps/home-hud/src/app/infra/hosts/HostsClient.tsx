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
import { EditHostModal } from './EditHostModal';
import type {
  Host,
  HostCpuMetrics,
  HostStatus,
  HostType,
} from './lib/homelab-api';

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

interface MetricPanelProps {
  label: string;
  value: string;
  status?: HostStatus;
  note: string;
}

/** Skeleton metric card — real graphs land in a follow-up; for now this just
 * reserves the layout and shows whatever indicator value is already
 * available (today: only CPU, from Prometheus). */
function MetricPanel({ label, value, status, note }: MetricPanelProps) {
  return (
    <Panel color="default" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Typography variant="small" className="text-neutral-400">
          {label}
        </Typography>
        <Badge color={status ? STATUS_BADGE_COLOR[status] : 'dark'}>
          {value}
        </Badge>
      </div>
      <div className="flex h-20 items-center justify-center border border-dashed border-neutral-600 bg-neutral-900/40">
        <Typography variant="caption" className="text-neutral-500">
          {note}
        </Typography>
      </div>
    </Panel>
  );
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
}: {
  host: Host;
  onEdit: () => void;
  cpuMetrics: HostCpuMetrics | null;
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

      {/* Placeholder for a real host image/photo, addressed in a follow-up. */}
      <div className="flex h-56 w-full items-center justify-center border border-neutral-700 bg-gradient-to-br from-neutral-900 to-neutral-700">
        <Typography variant="body2" className="text-neutral-500">
          No image yet
        </Typography>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CpuMetricPanel
          value={formatPercent(host.cpuUsageRatio)}
          cpuMetrics={cpuMetrics}
        />
        <MetricPanel label="Memory" value="—" note="not wired up yet" />
        <MetricPanel
          label="Disk (root fs used)"
          value="—"
          note="not wired up yet"
        />
        <MetricPanel label="Temperature" value="—" note="not wired up yet" />
      </div>
    </Panel>
  );
}

interface HostsClientProps {
  hosts: Host[] | null;
  hostType: HostType;
  selectedHostId: string | null;
  cpuMetrics: HostCpuMetrics | null;
}

export function HostsClient({
  hosts,
  hostType,
  selectedHostId,
  cpuMetrics,
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
              host={selectedHost}
              onEdit={() => setEditModalOpen(true)}
              cpuMetrics={cpuMetrics}
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
