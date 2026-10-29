import fsPromises from 'fs/promises';
import {
  checkNfsMount,
  parseProcMounts,
  type ExpectedExport,
  type MountEntry,
} from '../destination/mounts';
import { DestinationUnhealthyError } from './errors';

export const readProcMounts = async (): Promise<MountEntry[]> =>
  parseProcMounts(await fsPromises.readFile('/proc/mounts', 'utf8'));

/**
 * Run before each item: the mount point must still be the NFS export the
 * destination expects. Without it a lost mount would let the worker write
 * into the container's own filesystem. Skipped with the mount check `none`.
 */
export const assertMounted = async (input: {
  mountCheck: string;
  mountPath: string;
  expected: ExpectedExport;
  readMounts?: () => Promise<MountEntry[]>;
  run?: <T>(operation: string, fn: () => Promise<T>) => Promise<T>;
}): Promise<void> => {
  if (input.mountCheck !== 'nfs') return;

  const run = input.run ?? ((_operation, fn) => fn());
  let mounts: MountEntry[];

  try {
    mounts = await run('read mounts', input.readMounts ?? readProcMounts);
  } catch (err) {
    throw new DestinationUnhealthyError(
      'read mounts',
      (err as NodeJS.ErrnoException)?.code ?? 'ERROR',
      `could not read /proc/mounts: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const result = checkNfsMount(mounts, input.mountPath, input.expected);

  if ('message' in result) {
    throw new DestinationUnhealthyError('mount', 'ENOTCONN', result.message);
  }
};
