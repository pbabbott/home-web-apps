import { createHash } from 'node:crypto';
import {
  ConnectionError,
  FakeDriver,
  type ConnectionTarget,
  type TreeEntry,
} from '../../src';

const target = {} as ConnectionTarget;
const options = { stallTimeoutMs: 1 };

const drain = async (stream: AsyncIterable<Buffer>) => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk);

  return Buffer.concat(chunks);
};

const tree = async (driver: FakeDriver, path: string) => {
  const items: TreeEntry[] = [];
  for await (const item of driver.listTree(target, path)) items.push(item);

  return items;
};

describe('FakeDriver', () => {
  const build = () =>
    new FakeDriver()
      .addFile('C:\\src\\a.txt', 'hello', {
        modifiedAt: new Date('2019-05-06T07:08:09Z'),
        streams: [{ name: 'Zone.Identifier', content: '[ZoneTransfer]' }],
      })
      .addFile('C:\\src\\sub\\b.bin', Buffer.alloc(200_000, 7))
      .addDirectory('C:\\src\\empty');

  it('lists a tree with parents implied and names as written', async () => {
    const entries = await tree(build(), 'C:\\src');

    expect(entries.map((e) => e.relPath)).toEqual([
      'a.txt',
      'empty',
      'sub',
      'sub\\b.bin',
    ]);
  });

  it('streams content in chunks', async () => {
    const content = await drain(
      build().openStream(target, 'C:\\src\\sub\\b.bin', options),
    );

    expect(createHash('sha256').update(content).digest('hex')).toBe(
      createHash('sha256').update(Buffer.alloc(200_000, 7)).digest('hex'),
    );
  });

  it('moves the access time when a file is read, not when it is described', async () => {
    const driver = build();
    const before = driver.timesOf('C:\\src\\a.txt').accessedAt;

    await driver.allinfo(target, ['C:\\src\\a.txt']);
    expect(driver.timesOf('C:\\src\\a.txt').accessedAt).toEqual(before);

    await drain(driver.openStream(target, 'C:\\src\\a.txt', options));
    expect(driver.timesOf('C:\\src\\a.txt').accessedAt).not.toEqual(before);
  });

  it('describes files, directories and missing paths', async () => {
    const [file, dir, missing] = await build().allinfo(target, [
      'C:\\src\\a.txt',
      'C:\\src\\empty',
      'C:\\src\\nope',
    ]);

    expect(file).toMatchObject({
      size: 5,
      modifiedAt: new Date('2019-05-06T07:08:09Z'),
      streams: [{ name: 'Zone.Identifier', size: 14 }],
    });
    expect(dir).toMatchObject({ isDirectory: true });
    expect((missing as ConnectionError).code).toBe('not_found');
  });

  it('reads a named stream', async () => {
    const driver = build();

    await expect(
      driver.readNamedStream(target, 'C:\\src\\a.txt', 'Zone.Identifier', 4096),
    ).resolves.toBe('[ZoneTransfer]');
    await expect(
      driver.readNamedStream(
        target,
        'C:\\src\\sub\\b.bin',
        'Zone.Identifier',
        4096,
      ),
    ).resolves.toBeNull();
  });

  it('ends a stream early without an error for a short fault', async () => {
    const driver = build().fault('C:\\src\\a.txt', { kind: 'short', bytes: 2 });

    expect(
      (await drain(driver.openStream(target, 'C:\\src\\a.txt', options)))
        .length,
    ).toBe(2);
  });

  it('fails a stream after some bytes for an error fault, once when asked', async () => {
    const driver = build().fault('C:\\src\\sub\\b.bin', {
      kind: 'error',
      afterBytes: 70_000,
      times: 1,
    });

    await expect(
      drain(driver.openStream(target, 'C:\\src\\sub\\b.bin', options)),
    ).rejects.toThrow('read failed');
    await expect(
      drain(driver.openStream(target, 'C:\\src\\sub\\b.bin', options)),
    ).resolves.toHaveLength(200_000);
  });

  it('shows a junction as a directory that cannot be entered, or hides it', async () => {
    const driver = build()
      .addJunction('C:\\src\\Cookies')
      .addJunction('C:\\src\\Hidden', { listed: false });
    const entries = await tree(driver, 'C:\\src');

    expect(entries.map((e) => `${e.kind}:${e.relPath}`)).toEqual(
      expect.arrayContaining(['entry:Cookies', 'error:Cookies']),
    );
    expect(entries.some((e) => e.relPath === 'Hidden')).toBe(false);

    const [info] = await driver.allinfo(target, ['C:\\src\\Hidden']);
    expect(info).toMatchObject({ isReparsePoint: true });
  });

  it('reports an unlistable directory in place', async () => {
    const driver = build().addDirectory('C:\\src\\locked', {
      unlistable: true,
    });
    const entries = await tree(driver, 'C:\\src');

    expect(entries).toContainEqual(
      expect.objectContaining({ kind: 'error', relPath: 'locked' }),
    );
  });

  it('fails every call when the machine is unreachable', async () => {
    const driver = build();
    driver.unreachable = true;

    await expect(driver.test()).resolves.toMatchObject({ ok: false });
    const [info] = await driver.allinfo(target, ['C:\\src\\a.txt']);
    expect((info as ConnectionError).code).toBe('unreachable');
  });

  it('removes a file or a tree', async () => {
    const driver = build().remove('C:\\src\\sub');

    expect((await tree(driver, 'C:\\src')).map((e) => e.relPath)).toEqual([
      'a.txt',
      'empty',
    ]);
  });
  it('hangs after the given bytes and ends with stalled after the stall timeout', async () => {
    const driver = build().fault('C:\\src\\sub\\b.bin', {
      kind: 'hang',
      afterBytes: 1000,
    });
    const chunks: Buffer[] = [];
    const read = async () => {
      for await (const chunk of driver.openStream(
        target,
        'C:\\src\\sub\\b.bin',
        { stallTimeoutMs: 50 },
      )) {
        chunks.push(chunk);
      }
    };

    await expect(read()).rejects.toMatchObject({ code: 'stalled' });
    expect(Buffer.concat(chunks)).toHaveLength(1000);
  });

  it('ends a hanging read when it is aborted', async () => {
    const driver = build().fault('C:\\src\\sub\\b.bin', {
      kind: 'hang',
      afterBytes: 0,
    });
    const controller = new AbortController();
    const read = drain(
      driver.openStream(target, 'C:\\src\\sub\\b.bin', {
        stallTimeoutMs: 60_000,
        signal: controller.signal,
      }),
    );

    setTimeout(() => controller.abort(new Error('shutdown')), 20);
    await expect(read).rejects.toThrow('shutdown');
    expect(driver.activeReads).toBe(0);
  });

  it('counts reads in flight and the most at once', async () => {
    const driver = build();
    const open = () =>
      driver.openStream(target, 'C:\\src\\sub\\b.bin', options);

    await Promise.all([drain(open()), drain(open()), drain(open())]);

    expect(driver.maxConcurrentReads).toBe(3);
    expect(driver.activeReads).toBe(0);
  });
});
