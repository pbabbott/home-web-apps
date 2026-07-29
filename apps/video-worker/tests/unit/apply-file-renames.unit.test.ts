import fs from 'fs';
import { execFile } from 'child_process';
import type { FileRename, VideoJob } from '@abbottland/video-db';
import {
  hashFile,
  listPendingFileRenames,
  updateFileRenameStatus,
} from '@abbottland/video-db';
import { runPawPatrolApplyFileRenamesOperation } from '../../src/worker/operations/paw-patrol-apply-file-renames';

jest.mock('fs');
jest.mock('child_process', () => ({
  execFile: jest.fn(
    (
      _file: string,
      _args: string[],
      callback: (err: Error | null, result?: unknown) => void,
    ) => callback(null, { stdout: '', stderr: '' }),
  ),
}));
jest.mock('../../src/config', () => ({
  config: { mediaRoot: '/media', ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe' },
}));
jest.mock('../../src/db', () => ({ db: {} }));
jest.mock('@abbottland/video-db', () => ({
  hashFile: jest.fn(),
  listPendingFileRenames: jest.fn(),
  updateFileRenameStatus: jest.fn(),
}));

const MEDIA_ROOT = '/media';
const absPath = (relPath: string): string => `${MEDIA_ROOT}/${relPath}`;

let nextId = 0;
const buildFileRename = (overrides: Partial<FileRename> = {}): FileRename => ({
  id: `id-${nextId++}`,
  fileHash: 'hash-default',
  originalFilePath: 'Paw Patrol/Season 3/orig.mp4',
  suggestedFilePath: 'Paw Patrol/Season 3/suggested.mp4',
  secondSuggestedFilePath: null,
  splitAtSeconds: null,
  sourceTitleCardTitles: null,
  status: 'pending',
  createdAt: new Date(),
  appliedAt: null,
  ...overrides,
});

// Paths considered present on disk for this test; mutated inline for tests
// that need a path's existence to change partway through (e.g. a split's
// outputs, which don't exist until ffmpeg "writes" them).
let existingPaths: Set<string>;

describe('runPawPatrolApplyFileRenamesOperation', () => {
  beforeEach(() => {
    existingPaths = new Set();
    (fs.existsSync as jest.Mock).mockImplementation((p: string) =>
      existingPaths.has(p),
    );
    (fs.statSync as jest.Mock).mockReturnValue({ size: 100 });
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.renameSync as jest.Mock).mockReturnValue(undefined);
    (updateFileRenameStatus as jest.Mock).mockResolvedValue({});
    (hashFile as jest.Mock).mockImplementation(async () => {
      throw new Error('hashFile called with no expectation set for this path');
    });
    (execFile as unknown as jest.Mock).mockImplementation(
      (
        _file: string,
        _args: string[],
        callback: (err: null, r: unknown) => void,
      ) => callback(null, { stdout: '', stderr: '' }),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockHash = (path: string, hash: string) => {
    (hashFile as jest.Mock).mockImplementation(async (p: string) => {
      if (p === path) return hash;
      throw new Error(`hashFile called with unexpected path: ${p}`);
    });
  };

  it('renames a file whose suggested path is free', async () => {
    const row = buildFileRename({
      fileHash: 'hash-1',
      originalFilePath: 'Paw Patrol/Season 3/random-name.mp4',
      suggestedFilePath: 'Paw Patrol/Season 3/Paw Patrol - S03E01 - Title.mp4',
    });
    (listPendingFileRenames as jest.Mock).mockResolvedValue([row]);

    existingPaths.add(absPath(row.originalFilePath));
    mockHash(absPath(row.originalFilePath), 'hash-1');

    const result = await runPawPatrolApplyFileRenamesOperation({
      parameters: {},
    } as VideoJob);

    expect(fs.renameSync).toHaveBeenCalledWith(
      absPath(row.originalFilePath),
      absPath(row.suggestedFilePath),
    );
    expect(updateFileRenameStatus).toHaveBeenCalledWith({}, row.id, 'applied');
    expect(result.outputPaths).toEqual([row.suggestedFilePath]);
    expect(result.message).toBe('applied 1 rename(s), skipped 0');
  });

  it('resolves a single-hop collision chain in LIFO order', async () => {
    const rowA = buildFileRename({
      fileHash: 'hash-a',
      originalFilePath: 'Paw Patrol/Season 3/a-orig.mp4',
      suggestedFilePath: 'Paw Patrol/Season 3/shared-target.mp4',
    });
    const rowB = buildFileRename({
      fileHash: 'hash-b',
      originalFilePath: 'Paw Patrol/Season 3/shared-target.mp4',
      suggestedFilePath: 'Paw Patrol/Season 3/b-target.mp4',
    });
    (listPendingFileRenames as jest.Mock).mockResolvedValue([rowA, rowB]);

    existingPaths.add(absPath(rowA.originalFilePath));
    existingPaths.add(absPath(rowB.originalFilePath)); // == rowA's suggested path
    mockHashMap({
      [absPath(rowA.originalFilePath)]: 'hash-a',
      [absPath(rowB.originalFilePath)]: 'hash-b',
    });

    const result = await runPawPatrolApplyFileRenamesOperation({
      parameters: {},
    } as VideoJob);

    expect((fs.renameSync as jest.Mock).mock.calls).toEqual([
      [absPath(rowB.originalFilePath), absPath(rowB.suggestedFilePath)], // B moves first
      [absPath(rowA.originalFilePath), absPath(rowA.suggestedFilePath)], // then A
    ]);
    expect(result.message).toBe('applied 2 rename(s), skipped 0');
  });

  it('resolves a multi-hop collision chain in LIFO order', async () => {
    const rowA = buildFileRename({
      fileHash: 'hash-a',
      originalFilePath: 'Paw Patrol/Season 3/a-orig.mp4',
      suggestedFilePath: 'Paw Patrol/Season 3/b-orig.mp4',
    });
    const rowB = buildFileRename({
      fileHash: 'hash-b',
      originalFilePath: 'Paw Patrol/Season 3/b-orig.mp4',
      suggestedFilePath: 'Paw Patrol/Season 3/c-orig.mp4',
    });
    const rowC = buildFileRename({
      fileHash: 'hash-c',
      originalFilePath: 'Paw Patrol/Season 3/c-orig.mp4',
      suggestedFilePath: 'Paw Patrol/Season 3/c-target.mp4',
    });
    (listPendingFileRenames as jest.Mock).mockResolvedValue([rowA, rowB, rowC]);

    existingPaths.add(absPath(rowA.originalFilePath));
    existingPaths.add(absPath(rowB.originalFilePath));
    existingPaths.add(absPath(rowC.originalFilePath));
    mockHashMap({
      [absPath(rowA.originalFilePath)]: 'hash-a',
      [absPath(rowB.originalFilePath)]: 'hash-b',
      [absPath(rowC.originalFilePath)]: 'hash-c',
    });

    await runPawPatrolApplyFileRenamesOperation({ parameters: {} } as VideoJob);

    expect((fs.renameSync as jest.Mock).mock.calls).toEqual([
      [absPath(rowC.originalFilePath), absPath(rowC.suggestedFilePath)],
      [absPath(rowB.originalFilePath), absPath(rowB.suggestedFilePath)],
      [absPath(rowA.originalFilePath), absPath(rowA.suggestedFilePath)],
    ]);
  });

  it('splits a file into two segments when both targets are free', async () => {
    const row = buildFileRename({
      fileHash: 'hash-split',
      originalFilePath: 'Paw Patrol/Season 3/combined.mp4',
      suggestedFilePath: 'Paw Patrol/Season 3/e18.mp4',
      secondSuggestedFilePath: 'Paw Patrol/Season 3/e19.mp4',
      splitAtSeconds: 660,
    });
    (listPendingFileRenames as jest.Mock).mockResolvedValue([row]);

    const originalAbs = absPath(row.originalFilePath);
    const abs1 = absPath(row.suggestedFilePath);
    const abs2 = absPath(row.secondSuggestedFilePath as string);

    existingPaths.add(originalAbs);
    mockHash(originalAbs, 'hash-split');

    let outputsWritten = false;
    (fs.existsSync as jest.Mock).mockImplementation((p: string) => {
      if ((p === abs1 || p === abs2) && outputsWritten) return true;
      return existingPaths.has(p);
    });
    (execFile as unknown as jest.Mock).mockImplementation(
      (
        file: string,
        _args: string[],
        callback: (err: null, r: unknown) => void,
      ) => {
        if (file === 'ffprobe') {
          callback(null, { stdout: '660\n', stderr: '' });
        } else {
          outputsWritten = true;
          callback(null, { stdout: '', stderr: '' });
        }
      },
    );

    const result = await runPawPatrolApplyFileRenamesOperation({
      parameters: {},
    } as VideoJob);

    expect(execFile).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-t', '660']),
      expect.any(Function),
    );
    expect(execFile).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-ss', '660']),
      expect.any(Function),
    );
    expect(fs.renameSync).toHaveBeenCalledWith(
      originalAbs,
      absPath('discarded/Paw Patrol/Season 3/combined.mp4'),
    );
    expect(updateFileRenameStatus).toHaveBeenCalledWith({}, row.id, 'applied');
    expect(result.outputPaths).toEqual([
      row.suggestedFilePath,
      row.secondSuggestedFilePath,
      'discarded/Paw Patrol/Season 3/combined.mp4',
    ]);
  });

  it('resolves a chain on one split target before splitting', async () => {
    const blocker = buildFileRename({
      fileHash: 'hash-blocker',
      originalFilePath: 'Paw Patrol/Season 3/e19.mp4', // occupies the split's 2nd target
      suggestedFilePath: 'Paw Patrol/Season 3/blocker-target.mp4',
    });
    const splitRow = buildFileRename({
      fileHash: 'hash-split',
      originalFilePath: 'Paw Patrol/Season 3/combined.mp4',
      suggestedFilePath: 'Paw Patrol/Season 3/e18.mp4',
      secondSuggestedFilePath: 'Paw Patrol/Season 3/e19.mp4',
      splitAtSeconds: 660,
    });
    (listPendingFileRenames as jest.Mock).mockResolvedValue([
      splitRow,
      blocker,
    ]);

    const combinedAbs = absPath(splitRow.originalFilePath);
    const abs1 = absPath(splitRow.suggestedFilePath);
    const abs2 = absPath(splitRow.secondSuggestedFilePath as string); // == blocker's original
    const blockerTargetAbs = absPath(blocker.suggestedFilePath);

    existingPaths.add(combinedAbs);
    existingPaths.add(abs2); // blocker currently sits here
    mockHashMap({
      [combinedAbs]: 'hash-split',
      [abs2]: 'hash-blocker',
    });

    let outputsWritten = false;
    (fs.existsSync as jest.Mock).mockImplementation((p: string) => {
      if (p === abs1 && outputsWritten) return true;
      if (p === abs2) return outputsWritten ? true : existingPaths.has(p);
      return existingPaths.has(p);
    });
    (execFile as unknown as jest.Mock).mockImplementation(
      (
        file: string,
        _args: string[],
        callback: (err: null, r: unknown) => void,
      ) => {
        if (file === 'ffprobe') {
          callback(null, { stdout: '660\n', stderr: '' });
        } else {
          outputsWritten = true;
          callback(null, { stdout: '', stderr: '' });
        }
      },
    );

    const result = await runPawPatrolApplyFileRenamesOperation({
      parameters: {},
    } as VideoJob);

    // blocker moves out of the way before the split runs
    expect(fs.renameSync).toHaveBeenCalledWith(abs2, blockerTargetAbs);
    expect(fs.renameSync).toHaveBeenCalledWith(
      combinedAbs,
      absPath('discarded/Paw Patrol/Season 3/combined.mp4'),
    );
    expect(result.message).toBe('applied 2 rename(s), skipped 0');
  });

  it('leaves a row pending on an untracked collision, and still applies the rest', async () => {
    const stuck = buildFileRename({
      fileHash: 'hash-stuck',
      originalFilePath: 'Paw Patrol/Season 3/stuck-orig.mp4',
      suggestedFilePath: 'Paw Patrol/Season 3/stuck-target.mp4',
    });
    const healthy = buildFileRename({
      fileHash: 'hash-healthy',
      originalFilePath: 'Paw Patrol/Season 3/healthy-orig.mp4',
      suggestedFilePath: 'Paw Patrol/Season 3/healthy-target.mp4',
    });
    (listPendingFileRenames as jest.Mock).mockResolvedValue([stuck, healthy]);

    existingPaths.add(absPath(stuck.originalFilePath));
    existingPaths.add(absPath(stuck.suggestedFilePath)); // occupied, no row explains it
    existingPaths.add(absPath(healthy.originalFilePath));
    mockHashMap({
      [absPath(stuck.originalFilePath)]: 'hash-stuck',
      [absPath(healthy.originalFilePath)]: 'hash-healthy',
    });

    const result = await runPawPatrolApplyFileRenamesOperation({
      parameters: {},
    } as VideoJob);

    expect(fs.renameSync).not.toHaveBeenCalledWith(
      absPath(stuck.originalFilePath),
      expect.anything(),
    );
    expect(updateFileRenameStatus).not.toHaveBeenCalledWith(
      {},
      stuck.id,
      'applied',
    );
    expect(updateFileRenameStatus).toHaveBeenCalledWith(
      {},
      healthy.id,
      'applied',
    );
    expect(result.message).toBe(
      'applied 1 rename(s), skipped 1 (1 untracked-collision)',
    );
  });

  it('leaves both rows pending on a cycle, without duplicate skip records', async () => {
    const rowA = buildFileRename({
      fileHash: 'hash-a',
      originalFilePath: 'Paw Patrol/Season 3/a.mp4',
      suggestedFilePath: 'Paw Patrol/Season 3/b.mp4',
    });
    const rowB = buildFileRename({
      fileHash: 'hash-b',
      originalFilePath: 'Paw Patrol/Season 3/b.mp4',
      suggestedFilePath: 'Paw Patrol/Season 3/a.mp4',
    });
    (listPendingFileRenames as jest.Mock).mockResolvedValue([rowA, rowB]);

    existingPaths.add(absPath(rowA.originalFilePath));
    existingPaths.add(absPath(rowB.originalFilePath));
    mockHashMap({
      [absPath(rowA.originalFilePath)]: 'hash-a',
      [absPath(rowB.originalFilePath)]: 'hash-b',
    });

    const result = await runPawPatrolApplyFileRenamesOperation({
      parameters: {},
    } as VideoJob);

    expect(fs.renameSync).not.toHaveBeenCalled();
    expect(updateFileRenameStatus).not.toHaveBeenCalled();
    expect(result.message).toBe('applied 0 rename(s), skipped 2 (2 cycle)');
  });

  it('recognizes a rename already applied by a crashed prior run (source gone, destination correct)', async () => {
    const row = buildFileRename({
      fileHash: 'hash-1',
      originalFilePath: 'Paw Patrol/Season 3/orig.mp4',
      suggestedFilePath: 'Paw Patrol/Season 3/suggested.mp4',
    });
    (listPendingFileRenames as jest.Mock).mockResolvedValue([row]);

    // original is gone; suggested path already holds the tracked file
    existingPaths.add(absPath(row.suggestedFilePath));
    mockHash(absPath(row.suggestedFilePath), 'hash-1');

    const result = await runPawPatrolApplyFileRenamesOperation({
      parameters: {},
    } as VideoJob);

    expect(fs.renameSync).not.toHaveBeenCalled();
    expect(updateFileRenameStatus).toHaveBeenCalledWith({}, row.id, 'applied');
    expect(result.message).toBe('applied 1 rename(s), skipped 0');
  });

  it('skips a row whose source hash no longer matches, without touching it', async () => {
    const row = buildFileRename({
      fileHash: 'hash-expected',
      originalFilePath: 'Paw Patrol/Season 3/orig.mp4',
      suggestedFilePath: 'Paw Patrol/Season 3/suggested.mp4',
    });
    (listPendingFileRenames as jest.Mock).mockResolvedValue([row]);

    existingPaths.add(absPath(row.originalFilePath));
    mockHash(absPath(row.originalFilePath), 'hash-different');

    const result = await runPawPatrolApplyFileRenamesOperation({
      parameters: {},
    } as VideoJob);

    expect(fs.renameSync).not.toHaveBeenCalled();
    expect(updateFileRenameStatus).not.toHaveBeenCalled();
    expect(execFile).not.toHaveBeenCalled();
    expect(result.message).toBe(
      'applied 0 rename(s), skipped 1 (1 hash-mismatch)',
    );
  });

  it('continues processing after one row throws unexpectedly', async () => {
    const broken = buildFileRename({
      fileHash: 'hash-broken',
      originalFilePath: 'Paw Patrol/Season 3/broken.mp4',
      suggestedFilePath: 'Paw Patrol/Season 3/broken-target.mp4',
    });
    const healthy = buildFileRename({
      fileHash: 'hash-healthy',
      originalFilePath: 'Paw Patrol/Season 3/healthy-orig.mp4',
      suggestedFilePath: 'Paw Patrol/Season 3/healthy-target.mp4',
    });
    (listPendingFileRenames as jest.Mock).mockResolvedValue([broken, healthy]);

    existingPaths.add(absPath(broken.originalFilePath));
    existingPaths.add(absPath(healthy.originalFilePath));
    (hashFile as jest.Mock).mockImplementation(async (p: string) => {
      if (p === absPath(broken.originalFilePath)) {
        throw new Error('disk read error');
      }
      if (p === absPath(healthy.originalFilePath)) return 'hash-healthy';
      throw new Error(`unexpected hashFile path: ${p}`);
    });

    const result = await runPawPatrolApplyFileRenamesOperation({
      parameters: {},
    } as VideoJob);

    expect(updateFileRenameStatus).toHaveBeenCalledWith(
      {},
      healthy.id,
      'applied',
    );
    expect(result.message).toBe('applied 1 rename(s), skipped 1 (1 error)');
  });
});

function mockHashMap(map: Record<string, string>) {
  (hashFile as jest.Mock).mockImplementation(async (p: string) => {
    if (p in map) return map[p];
    throw new Error(`hashFile called with unexpected path: ${p}`);
  });
}
