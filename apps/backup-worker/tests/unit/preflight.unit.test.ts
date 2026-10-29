import { DestinationUnhealthyError } from '../../src/copy/errors';
import { assertMounted } from '../../src/copy/preflight';

const expected = {
  serverNames: ['192.168.4.124', 'nas'],
  exportPath: '/volume1/Dump',
};
const mounted = {
  device: '192.168.4.124:/volume1/Dump',
  mountPoint: '/backup',
  fsType: 'nfs4',
  options: ['rw'],
};

describe('assertMounted', () => {
  const base = { mountCheck: 'nfs', mountPath: '/backup', expected };

  it('passes for the expected export', async () => {
    await expect(
      assertMounted({ ...base, readMounts: async () => [mounted] }),
    ).resolves.toBeUndefined();
  });

  it('does nothing with the mount check off', async () => {
    const readMounts = jest.fn();

    await assertMounted({ ...base, mountCheck: 'none', readMounts });

    expect(readMounts).not.toHaveBeenCalled();
  });

  it('makes the destination unhealthy when the mount is gone or is another export', async () => {
    await expect(
      assertMounted({ ...base, readMounts: async () => [] }),
    ).rejects.toBeInstanceOf(DestinationUnhealthyError);
    await expect(
      assertMounted({
        ...base,
        readMounts: async () => [
          { ...mounted, device: '192.168.4.124:/volume1/Media' },
        ],
      }),
    ).rejects.toBeInstanceOf(DestinationUnhealthyError);
  });

  it('makes the destination unhealthy when /proc/mounts cannot be read', async () => {
    await expect(
      assertMounted({
        ...base,
        readMounts: async () => {
          throw Object.assign(new Error('boom'), { code: 'EIO' });
        },
      }),
    ).rejects.toMatchObject({ code: 'EIO' });
  });
});
