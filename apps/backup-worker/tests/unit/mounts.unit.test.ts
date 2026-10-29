import {
  checkNfsMount,
  mountedExport,
  parseProcMounts,
} from '../../src/destination/mounts';

const expected = {
  serverNames: ['192.168.4.124', 'nas'],
  exportPath: '/volume1/Dump',
};

describe('parseProcMounts', () => {
  it('parses fields and unescapes octal sequences', () => {
    const [entry] = parseProcMounts(
      '192.168.4.124:/volume1/Dump /mnt/my\\040backup nfs4 rw,hard,vers=4.2 0 0\n',
    );

    expect(entry).toEqual({
      device: '192.168.4.124:/volume1/Dump',
      mountPoint: '/mnt/my backup',
      fsType: 'nfs4',
      options: ['rw', 'hard', 'vers=4.2'],
    });
  });

  it('ignores blank and short lines', () => {
    expect(parseProcMounts('\n\nbroken line\n')).toEqual([]);
  });
});

describe('checkNfsMount', () => {
  const mount = (over = {}) => ({
    device: '192.168.4.124:/volume1/Dump',
    mountPoint: '/backup',
    fsType: 'nfs4',
    options: ['rw'],
    ...over,
  });

  it('accepts nfs and nfs4 of the expected server:exportPath', () => {
    expect(checkNfsMount([mount()], '/backup', expected).ok).toBe(true);
    expect(
      checkNfsMount([mount({ fsType: 'nfs' })], '/backup/', expected).ok,
    ).toBe(true);
  });

  it('accepts the host name as the server, in any case', () => {
    expect(
      checkNfsMount(
        [mount({ device: 'NAS:/volume1/Dump' })],
        '/backup',
        expected,
      ).ok,
    ).toBe(true);
  });

  it('rejects a path that is not a mount point', () => {
    const result = checkNfsMount([mount()], '/other', expected);
    expect(result).toMatchObject({ ok: false });
    expect('message' in result && result.message).toMatch(/not a mount point/);
  });

  it('rejects a filesystem that is not NFS', () => {
    const result = checkNfsMount(
      [mount({ fsType: 'ext4' })],
      '/backup',
      expected,
    );
    expect('message' in result && result.message).toMatch(/ext4/);
  });

  it('rejects a different server or export path', () => {
    for (const device of [
      '10.0.0.1:/volume1/Dump',
      '192.168.4.124:/volume1/Media',
    ]) {
      const result = checkNfsMount([mount({ device })], '/backup', expected);
      expect('message' in result && result.message).toMatch(/expected/);
    }
  });

  it('uses the last entry when mounts are stacked', () => {
    const stacked = [mount(), mount({ fsType: 'tmpfs', device: 'tmpfs' })];
    expect(checkNfsMount(stacked, '/backup', expected).ok).toBe(false);
  });
});

describe('mountedExport', () => {
  const mounts = parseProcMounts(
    [
      '192.168.4.124:/volume1/Dump /backup nfs4 rw,hard 0 0',
      'tmpfs /scratch tmpfs rw 0 0',
    ].join('\n'),
  );

  it('names the NFS export mounted at the path', () => {
    expect(mountedExport(mounts, '/backup')).toEqual({
      server: '192.168.4.124',
      exportPath: '/volume1/Dump',
    });
    expect(mountedExport(mounts, '/backup/')).toEqual({
      server: '192.168.4.124',
      exportPath: '/volume1/Dump',
    });
  });

  it('is null for a path that is not an NFS mount point', () => {
    expect(mountedExport(mounts, '/scratch')).toBeNull();
    expect(mountedExport(mounts, '/elsewhere')).toBeNull();
  });
});
