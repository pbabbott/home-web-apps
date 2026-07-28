import { execFile } from 'child_process';
import { getRuntimeSeconds } from '../../src/lib/get-runtime';

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));
jest.mock('../../src/config', () => ({
  config: { ffprobePath: 'ffprobe' },
}));

describe('getRuntimeSeconds', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rounds ffprobe stdout to the nearest whole second', async () => {
    (execFile as unknown as jest.Mock).mockImplementation(
      (
        _file: string,
        _args: string[],
        callback: (...args: unknown[]) => void,
      ) => callback(null, { stdout: '659.87\n', stderr: '' }),
    );

    await expect(getRuntimeSeconds('/media/e01.mp4')).resolves.toBe(660);
  });

  it('invokes ffprobe with the configured path against absPath', async () => {
    (execFile as unknown as jest.Mock).mockImplementation(
      (
        _file: string,
        _args: string[],
        callback: (...args: unknown[]) => void,
      ) => callback(null, { stdout: '0\n', stderr: '' }),
    );

    await getRuntimeSeconds('/media/e01.mp4');

    expect(execFile).toHaveBeenCalledWith(
      'ffprobe',
      expect.arrayContaining(['/media/e01.mp4']),
      expect.any(Function),
    );
  });
});
