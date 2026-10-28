import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ConnectionError,
  type ConnectionTarget,
  type TreeEntry,
} from '../../src/connections/types';
import { smbDriver, smbclientInvocation } from '../../src/connections/smb';

const target: ConnectionTarget = {
  address: '10.0.0.1',
  hostNames: ['pc'],
  username: 'me',
  domain: null,
  password: 'secret',
  settings: { shareMappings: [{ pathPrefix: 'C:\\', share: 'C' }] },
};

describe('smbclientInvocation', () => {
  it('runs the child in UTC so times are absolute', () => {
    expect(smbclientInvocation(target, []).env.TZ).toBe('UTC');
  });
});

const block = (name: string) =>
  [
    `altname: ${name}`,
    'create_time:    Fri Oct 23 15:30:23 2026 UTC',
    'access_time:    Fri Oct 23 15:30:26 2026 UTC',
    'write_time:     Wed Sep 20 03:20:03 2017 UTC',
    'change_time:    Mon Sep  9 09:54:58 2019 UTC',
    'attributes: A (20)',
    'stream: [::$DATA], 5 bytes',
  ].join('\n');

/** A fake `smbclient` first on PATH. The body is a shell script. */
describe('smbDriver with a fake smbclient', () => {
  let dir: string;
  const originalPath = process.env.PATH;

  const fakeSmbclient = (body: string) => {
    writeFileSync(join(dir, 'smbclient'), `#!/bin/sh\n${body}\n`);
    chmodSync(join(dir, 'smbclient'), 0o755);
  };
  /** The fake prints this text on stdout, whatever it is asked. */
  const fakePrints = (text: string, exitCode = 0) => {
    writeFileSync(join(dir, 'output.txt'), `${text}\n`);
    fakeSmbclient(`cat "${join(dir, 'output.txt')}"; exit ${exitCode}`);
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fake-smbclient-'));
    process.env.PATH = `${dir}:${originalPath}`;
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    rmSync(dir, { recursive: true, force: true });
  });

  const read = async (stream: AsyncIterable<Buffer>) => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk);

    return Buffer.concat(chunks).toString();
  };

  describe('openStream', () => {
    it('streams the data of a successful transfer', async () => {
      fakeSmbclient('printf hello');

      await expect(
        read(
          smbDriver.openStream(target, 'C:\\a.txt', { stallTimeoutMs: 5000 }),
        ),
      ).resolves.toBe('hello');
    });

    it('turns a non-zero exit into an error although the message came on stdout', async () => {
      fakePrints(
        'NT_STATUS_OBJECT_NAME_NOT_FOUND opening remote file \\a.txt',
        1,
      );

      await expect(
        read(
          smbDriver.openStream(target, 'C:\\a.txt', { stallTimeoutMs: 5000 }),
        ),
      ).rejects.toMatchObject({ code: 'not_found' });
    });

    it('kills a transfer that sends nothing for the stall timeout', async () => {
      fakeSmbclient('printf abc; exec sleep 30');
      const started = Date.now();

      await expect(
        read(
          smbDriver.openStream(target, 'C:\\a.txt', { stallTimeoutMs: 300 }),
        ),
      ).rejects.toMatchObject({ code: 'stalled' });
      expect(Date.now() - started).toBeLessThan(5000);
    });

    it('stops when aborted', async () => {
      fakeSmbclient('printf abc; exec sleep 30');
      const controller = new AbortController();
      const stream = smbDriver.openStream(target, 'C:\\a.txt', {
        stallTimeoutMs: 20_000,
        signal: controller.signal,
      });

      setTimeout(() => controller.abort(new Error('lease lost')), 100);

      await expect(read(stream)).rejects.toThrow('lease lost');
    });

    it('refuses a path smbclient could not address', () => {
      expect(() =>
        smbDriver.openStream(target, 'C:\\a;b.txt', { stallTimeoutMs: 1000 }),
      ).toThrow(ConnectionError);
    });
  });

  describe('readNamedStream', () => {
    it('returns the text of the stream', async () => {
      fakeSmbclient('printf "[ZoneTransfer]\\nZoneId=3"');

      await expect(
        smbDriver.readNamedStream(target, 'C:\\a.zip', 'Zone.Identifier', 4096),
      ).resolves.toBe('[ZoneTransfer]\nZoneId=3');
    });

    it('cuts the text at maxBytes', async () => {
      fakeSmbclient('printf 0123456789');

      await expect(
        smbDriver.readNamedStream(target, 'C:\\a.zip', 'Zone.Identifier', 4),
      ).resolves.toBe('0123');
    });

    it('is null when the file has no such stream', async () => {
      fakePrints('NT_STATUS_OBJECT_NAME_NOT_FOUND opening remote file x', 1);

      await expect(
        smbDriver.readNamedStream(target, 'C:\\a.zip', 'Zone.Identifier', 4096),
      ).resolves.toBeNull();
    });
  });

  describe('listTree', () => {
    const collect = async (iterable: AsyncIterable<TreeEntry>) => {
      const items: TreeEntry[] = [];
      for await (const item of iterable) items.push(item);

      return items;
    };

    it('streams the entries of a recursive listing', async () => {
      fakePrints(
        [
          '  .                                   D        0  Mon Apr 25 15:57:01 2016',
          '  sub                                 D        0  Mon Apr 25 15:57:01 2016',
          '  a.txt                               A        3  Mon Apr 25 15:57:01 2016',
          '',
          '\\dir\\sub',
          '  b.txt                               A        4  Mon Apr 25 15:57:01 2016',
        ].join('\n'),
      );

      const items = await collect(smbDriver.listTree(target, 'C:\\dir'));

      expect(items.map((i) => i.relPath)).toEqual([
        'sub',
        'a.txt',
        'sub\\b.txt',
      ]);
    });

    it('throws when the root cannot be listed', async () => {
      fakePrints('NT_STATUS_OBJECT_NAME_NOT_FOUND listing \\dir\\*');

      await expect(
        collect(smbDriver.listTree(target, 'C:\\dir')),
      ).rejects.toMatchObject({ code: 'not_found' });
    });

    it('throws when the share cannot be reached', async () => {
      fakePrints('tree connect failed: NT_STATUS_BAD_NETWORK_NAME', 1);

      await expect(
        collect(smbDriver.listTree(target, 'C:\\dir')),
      ).rejects.toMatchObject({ code: 'no_share' });
    });
  });

  describe('allinfo', () => {
    it('answers one result per path, in order, with failures in place', async () => {
      fakePrints(
        [
          block('A.TXT'),
          'NT_STATUS_OBJECT_NAME_NOT_FOUND getting alt name for \\nope.txt',
          block('B.TXT'),
        ].join('\n'),
      );

      const results = await smbDriver.allinfo(target, [
        'C:\\a.txt',
        'C:\\nope.txt',
        'C:\\b.txt',
      ]);

      expect(results[0]).toMatchObject({ size: 5 });
      expect(results[1]).toBeInstanceOf(ConnectionError);
      expect((results[1] as ConnectionError).code).toBe('not_found');
      expect(results[2]).toMatchObject({ size: 5 });
    });

    it('redoes a batch one path at a time when blocks are missing', async () => {
      // Several allinfo commands in one session answer a single block, one
      // command answers fully.
      writeFileSync(join(dir, 'one.txt'), `${block('X.TXT')}\n`);
      fakeSmbclient(
        `case "$*" in *";"*) cat "${join(dir, 'one.txt')}" ;; *) cat "${join(dir, 'one.txt')}" ;; esac`,
      );

      const results = await smbDriver.allinfo(target, [
        'C:\\a.txt',
        'C:\\b.txt',
      ]);

      expect(results.every((r) => !(r instanceof ConnectionError))).toBe(true);
    });

    it('reports a path no share serves without calling smbclient', async () => {
      fakeSmbclient('exit 99');

      const [result] = await smbDriver.allinfo(
        { ...target, settings: { shareMappings: [] }, hostNames: [] },
        ['\\\\other\\share\\a.txt'],
      );

      expect(result).toBeInstanceOf(ConnectionError);
      expect((result as ConnectionError).code).toBe('no_share');
    });
  });
});
