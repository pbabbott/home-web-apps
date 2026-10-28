import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { DestFs } from '../../src/copy/dest-fs';
import { removeStaleStaging } from '../../src/copy/staging-cleanup';

const ACTIVE = '11111111-1111-4111-8111-111111111111';
const STALE = '22222222-2222-4222-8222-222222222222';

describe('removeStaleStaging', () => {
  let mount: string;
  let dest: DestFs;
  const staging = () => path.join(mount, '.exodus-staging');

  beforeEach(async () => {
    mount = await fs.mkdtemp(path.join(os.tmpdir(), 'staging-cleanup-'));
    dest = new DestFs(mount, mount);
  });

  afterEach(() => fs.rm(mount, { recursive: true, force: true }));

  const stage = async (...names: string[]) => {
    for (const name of names) {
      await fs.mkdir(path.join(staging(), name), { recursive: true });
      await fs.writeFile(path.join(staging(), name, '1'), 'partial');
    }
  };

  it('does nothing when there is no staging area', async () => {
    await expect(removeStaleStaging(dest, async () => false)).resolves.toEqual(
      [],
    );
  });

  it('removes folders of items that are not in progress and the area once empty', async () => {
    await stage(STALE);

    await expect(removeStaleStaging(dest, async () => false)).resolves.toEqual([
      STALE,
    ]);
    await expect(fs.stat(staging())).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('keeps the folder of an item in progress, and names that are not item ids', async () => {
    await stage(ACTIVE, STALE, 'not-ours');

    const removed = await removeStaleStaging(dest, async (id) => id === ACTIVE);

    expect(removed).toEqual([STALE]);
    expect((await fs.readdir(staging())).sort()).toEqual(
      [ACTIVE, 'not-ours'].sort(),
    );
  });
});
