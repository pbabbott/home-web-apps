import { execFile } from 'child_process';
import {
  nearestKeyframe,
  probeKeyframeTimes,
} from '../../src/worker/operations/paw-patrol-apply-file-renames/lib/keyframes';

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
  config: { ffprobePath: 'ffprobe' },
}));

describe('nearestKeyframe', () => {
  it('returns null for an empty list', () => {
    expect(nearestKeyframe([], 45)).toBeNull();
  });

  it('returns the only candidate before the target', () => {
    expect(nearestKeyframe([10], 45)).toBe(10);
  });

  it('returns the closest keyframe after the target', () => {
    expect(nearestKeyframe([10, 60], 45)).toBe(60);
  });

  it('returns an exact match', () => {
    expect(nearestKeyframe([10, 45, 90], 45)).toBe(45);
  });

  it('prefers the earlier keyframe on a tie', () => {
    expect(nearestKeyframe([40, 50], 45)).toBe(40);
  });
});

describe('probeKeyframeTimes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('builds a -read_intervals window around the target and parses/sorts the CSV output', async () => {
    (execFile as unknown as jest.Mock).mockImplementation(
      (_file, _args, callback) =>
        callback(null, {
          stdout: '46.0\n44.5\nnot-a-number\n45.2\n',
          stderr: '',
        }),
    );

    const result = await probeKeyframeTimes('/media/e18-19.mp4', 45);

    expect(result).toEqual([44.5, 45.2, 46.0]);
    expect(execFile).toHaveBeenCalledWith(
      'ffprobe',
      expect.arrayContaining(['-read_intervals', '30%60', '/media/e18-19.mp4']),
      expect.any(Function),
    );
  });

  it('clamps the probe window start at 0 for an early split point', async () => {
    (execFile as unknown as jest.Mock).mockImplementation(
      (_file, _args, callback) => callback(null, { stdout: '', stderr: '' }),
    );

    await probeKeyframeTimes('/media/e01.mp4', 5);

    expect(execFile).toHaveBeenCalledWith(
      'ffprobe',
      expect.arrayContaining(['-read_intervals', '0%20']),
      expect.any(Function),
    );
  });
});
