import { getMountpointSpace } from '../api/prometheus';

// The NAS share Plex/Sonarr/Radarr store media on.
const MEDIA_DISK = { host: 'room_of_requirement', mountpoint: '/share/Media' };

export interface MediaDiskSpace {
  host: string;
  mountpoint: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  /** usedBytes / totalBytes, 0-1. */
  usedRatio: number;
}

/** Current usage of the media share, or `null` when Prometheus has no data for it. */
export async function getMediaDiskSpace(): Promise<MediaDiskSpace | null> {
  const { size, avail } = await getMountpointSpace(
    MEDIA_DISK.host,
    MEDIA_DISK.mountpoint,
  );
  if (size === null || avail === null || size <= 0) return null;

  const usedBytes = size - avail;
  return {
    ...MEDIA_DISK,
    totalBytes: size,
    usedBytes,
    availableBytes: avail,
    usedRatio: usedBytes / size,
  };
}
