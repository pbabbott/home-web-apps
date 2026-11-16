import { Typography } from '@abbottland/fui-components';
import { formatBytes } from '../../infra/cluster-map/lib/format-bytes';
import type { MediaDiskSpace } from '../lib/homelab-api';

interface DiskSpaceProps {
  diskSpace: MediaDiskSpace | null;
}

/** The media share's usage as text (`/share/Media 5.1 TiB / 21.7 TiB (23%)`) over a plain bar. */
export function DiskSpace({ diskSpace }: DiskSpaceProps) {
  if (diskSpace === null) {
    return (
      <Typography variant="body2" className="text-neutral-400">
        Unavailable.
      </Typography>
    );
  }

  const percent = Math.round(diskSpace.usedRatio * 100);

  return (
    <div className="flex flex-col gap-3">
      <Typography variant="body2">
        {diskSpace.mountpoint} {formatBytes(diskSpace.usedBytes)} /{' '}
        {formatBytes(diskSpace.totalBytes)} ({percent}%)
      </Typography>
      <div
        role="progressbar"
        aria-label={`${diskSpace.mountpoint} used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-3 w-full bg-neutral-700"
      >
        <div
          className="h-full bg-primary-600"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}
