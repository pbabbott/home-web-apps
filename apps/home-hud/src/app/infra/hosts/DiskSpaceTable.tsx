import { Typography } from '@abbottland/fui-components';
import type { HostDiskSpace } from './lib/homelab-api';
import { formatBytes } from './lib/format-bytes';

function usageBarColor(ratio: number): string {
  if (ratio >= 0.9) return 'bg-error-500';
  if (ratio >= 0.8) return 'bg-warning-400';
  return 'bg-success-500';
}

export function DiskSpaceTable({
  diskSpace,
}: {
  diskSpace: HostDiskSpace | null;
}) {
  if (!diskSpace || diskSpace.instance === null) {
    return (
      <div className="flex h-20 items-center justify-center border border-dashed border-neutral-600 bg-neutral-900/40">
        <Typography variant="caption" className="text-neutral-500">
          No instance configured for Prometheus scraping
        </Typography>
      </div>
    );
  }

  if (diskSpace.mountpoints.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center border border-dashed border-neutral-600 bg-neutral-900/40">
        <Typography variant="caption" className="text-neutral-500">
          No disk space data from Prometheus yet
        </Typography>
      </div>
    );
  }

  return (
    <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
      {diskSpace.mountpoints.map((mp) => (
        <div key={mp.mountpoint} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <Typography variant="caption" className="truncate text-neutral-300">
              {mp.mountpoint}
            </Typography>
            <Typography variant="caption" className="shrink-0 text-neutral-400">
              {formatBytes(mp.usedBytes)} / {formatBytes(mp.sizeBytes)} (
              {Math.round(mp.usedRatio * 100)}%)
            </Typography>
          </div>
          <div className="h-1.5 w-full bg-neutral-900">
            <div
              className={`h-full ${usageBarColor(mp.usedRatio)}`}
              style={{ width: `${Math.min(mp.usedRatio * 100, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
