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
  expected: { server: string; exportPath: string },
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

  const expectedDevice = `${expected.server}:${trimTrailingSlash(expected.exportPath)}`;

  if (trimTrailingSlash(entry.device) !== expectedDevice) {
    return {
      ok: false,
      entry,
      message: `${mountPath} is mounted from ${entry.device}, expected ${expectedDevice}`,
    };
  }

  return { ok: true, entry };
};
