import { DataList, Typography } from '@abbottland/fui-components';
import { formatBytes } from '../../infra/cluster-map/lib/format-bytes';
import type { MediaDiskSpace } from '../lib/homelab-api';
import { Row } from './Section';

interface DiskSpaceProps {
  diskSpace: MediaDiskSpace | null;
}

/** The media share's usage as label/value rows over a plain bar. */
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
      <DataList.Root color="primary" size="small" className="max-w-md">
        <Row label="Mount">{diskSpace.mountpoint}</Row>
        <Row label="Used">{formatBytes(diskSpace.usedBytes)}</Row>
        <Row label="Total">{formatBytes(diskSpace.totalBytes)}</Row>
        <Row label="Usage">{percent}%</Row>
      </DataList.Root>
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
