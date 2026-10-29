import {
  destinationServerNames,
  type BackupDestinationWithHost,
} from '@abbottland/homelab-db';

export type MountEntry = {
  device: string;
  mountPoint: string;
  fsType: string;
  options: string[];
};

/** /proc/mounts escapes space, tab, newline and backslash as octal. */
const unescapeMountField = (field: string): string =>
  field.replace(/\\([0-7]{3})/g, (_, octal: string) =>
    String.fromCharCode(parseInt(octal, 8)),
  );

export const parseProcMounts = (content: string): MountEntry[] =>
  content
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((fields) => fields.length >= 4)
    .map(([device, mountPoint, fsType, options]) => ({
      device: unescapeMountField(device),
      mountPoint: unescapeMountField(mountPoint),
      fsType,
      options: options.split(','),
    }));

const trimTrailingSlash = (value: string): string =>
  value.length > 1 ? value.replace(/\/+$/, '') : value;

/** The export a destination expects at its mount point: any of its host's names, plus the path. */
export type ExpectedExport = { serverNames: string[]; exportPath: string };

export const expectedExport = (
  destination: Pick<BackupDestinationWithHost, 'host' | 'settings'>,
): ExpectedExport => ({
  serverNames: destinationServerNames(destination.host),
  exportPath: destination.settings.exportPath,
});

export type MountCheckResult =
  | { ok: true; entry: MountEntry }
  | { ok: false; message: string; entry?: MountEntry };

/**
 * `mountPath` must be a mount point whose filesystem is NFS and whose device
 * is the destination's `server:exportPath`. When mounts are stacked at one
 * path the last entry wins, as in the kernel's view.
 */
export const checkNfsMount = (
  mounts: MountEntry[],
  mountPath: string,
  expected: ExpectedExport,
): MountCheckResult => {
  const target = trimTrailingSlash(mountPath);
  const entry = [...mounts]
    .reverse()
    .find((m) => trimTrailingSlash(m.mountPoint) === target);

  if (!entry) {
    return { ok: false, message: `${mountPath} is not a mount point` };
  }

  if (!['nfs', 'nfs4'].includes(entry.fsType)) {
    return {
      ok: false,
      entry,
      message: `${mountPath} is a ${entry.fsType} filesystem, not NFS`,
    };
  }

  const exportPath = trimTrailingSlash(expected.exportPath);
  const expectedDevices = expected.serverNames.map(
    (name) => `${name}:${exportPath}`,
  );
  const device = trimTrailingSlash(entry.device).toLowerCase();

  if (!expectedDevices.some((d) => d.toLowerCase() === device)) {
    return {
      ok: false,
      entry,
      message: `${mountPath} is mounted from ${entry.device}, expected ${expectedDevices[0]}`,
    };
  }

  return { ok: true, entry };
};

/**
 * The NFS export mounted at `mountPath` (its `server` and `exportPath`), or
 * null when nothing NFS is mounted there. This is how a worker finds which
 * destination it serves: the one that is this export.
 */
export const mountedExport = (
  mounts: MountEntry[],
  mountPath: string,
): { server: string; exportPath: string } | null => {
  const target = trimTrailingSlash(mountPath);
  const entry = [...mounts]
    .reverse()
    .find((m) => trimTrailingSlash(m.mountPoint) === target);

  if (!entry || !['nfs', 'nfs4'].includes(entry.fsType)) return null;

  const match = /^(.+?):(\/.*)$/.exec(entry.device);

  return match ? { server: match[1], exportPath: match[2] } : null;
};
