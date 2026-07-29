import fs from 'fs';
import { moveToDiscarded } from '../../src/worker/operations/paw-patrol-apply-file-renames/lib/discard';

jest.mock('fs');
jest.mock('../../src/config', () => ({
  config: { mediaRoot: '/media' },
}));

describe('moveToDiscarded', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('moves the file under discarded/, mirroring its relative path', () => {
    const destRelPath = moveToDiscarded(
      'Paw Patrol/Season 3/random-name.mp4',
      '/media/Paw Patrol/Season 3/random-name.mp4',
    );

    expect(destRelPath).toBe('discarded/Paw Patrol/Season 3/random-name.mp4');
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      '/media/discarded/Paw Patrol/Season 3',
      { recursive: true },
    );
    expect(fs.renameSync).toHaveBeenCalledWith(
      '/media/Paw Patrol/Season 3/random-name.mp4',
      '/media/discarded/Paw Patrol/Season 3/random-name.mp4',
    );
  });
});
