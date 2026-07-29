import fs from 'fs';
import { execFile } from 'child_process';
import { refineSplitPoint } from '../../src/worker/operations/paw-patrol-file-suggestions/lib/refine-split-point';
import { detectTitleCard } from '../../src/worker/operations/paw-patrol-title-cards/lib/detect-title-card';

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
  config: { mediaRoot: '/media', ffmpegPath: 'ffmpeg' },
}));
jest.mock(
  '../../src/worker/operations/paw-patrol-title-cards/lib/detect-title-card',
  () => ({
    detectTitleCard: jest.fn(),
  }),
);

describe('refineSplitPoint', () => {
  beforeEach(() => {
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('img'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('steps back in 0.1s increments while the card is still found', async () => {
    (detectTitleCard as jest.Mock)
      .mockResolvedValueOnce({ found: true, title: 'x' }) // 44.9
      .mockResolvedValueOnce({ found: true, title: 'x' }) // 44.8
      .mockResolvedValueOnce({ found: false }); // 44.7

    const result = await refineSplitPoint(3, 'hash-1', '/media/e18-19.mp4', 45);

    expect(result).toBe(44.8);
    expect(execFile).toHaveBeenCalledTimes(3);
    expect(execFile).toHaveBeenNthCalledWith(
      1,
      'ffmpeg',
      expect.arrayContaining(['-ss', '44.9', '-i', '/media/e18-19.mp4']),
      expect.any(Function),
    );
    expect(detectTitleCard).toHaveBeenNthCalledWith(
      3,
      'screenshots/Paw Patrol/Season 3/hash-1/44.7_refine_480x270.jpg',
      'aW1n',
      'image/jpeg',
    );
  });

  it('returns the coarse timestamp unchanged when the card is not found even one step back', async () => {
    (detectTitleCard as jest.Mock).mockResolvedValue({ found: false });

    const result = await refineSplitPoint(3, 'hash-1', '/media/e18-19.mp4', 45);

    expect(result).toBe(45);
    expect(execFile).toHaveBeenCalledTimes(1);
  });

  it('stops at the search bound if the card is found all the way back', async () => {
    (detectTitleCard as jest.Mock).mockResolvedValue({
      found: true,
      title: 'x',
    });

    const result = await refineSplitPoint(3, 'hash-1', '/media/e18-19.mp4', 45);

    expect(result).toBe(42.5);
    expect(execFile).toHaveBeenCalledTimes(25);
  });

  it('skips ffmpeg for a refine screenshot that already exists on disk', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (detectTitleCard as jest.Mock).mockResolvedValueOnce({ found: false });

    await refineSplitPoint(3, 'hash-1', '/media/e18-19.mp4', 45);

    expect(execFile).not.toHaveBeenCalled();
  });

  it('never probes a negative timestamp', async () => {
    (detectTitleCard as jest.Mock).mockResolvedValue({
      found: true,
      title: 'x',
    });

    const result = await refineSplitPoint(
      3,
      'hash-1',
      '/media/e18-19.mp4',
      0.1,
    );

    expect(result).toBe(0);
    expect(execFile).toHaveBeenCalledTimes(1);
  });
});
