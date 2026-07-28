import {
  buildPlexEpisodeFilename,
  buildPlexEpisodeRelPath,
} from '../../src/worker/operations/paw-patrol-file-suggestions/lib/plex-filename';

describe('buildPlexEpisodeFilename', () => {
  it('pads season/episode numbers to 2 digits', () => {
    expect(buildPlexEpisodeFilename(3, 1, 'Pups Save a Blimp', '.mp4')).toBe(
      'Paw Patrol - S03E01 - Pups Save a Blimp.mp4',
    );
  });

  it('handles double-digit season/episode numbers', () => {
    expect(buildPlexEpisodeFilename(12, 34, 'Title', '.mkv')).toBe(
      'Paw Patrol - S12E34 - Title.mkv',
    );
  });

  it('strips filesystem-illegal characters from the title', () => {
    expect(
      buildPlexEpisodeFilename(3, 1, 'Pups: Save/the "Blimp"?', '.mp4'),
    ).toBe('Paw Patrol - S03E01 - Pups Savethe Blimp.mp4');
  });
});

describe('buildPlexEpisodeRelPath', () => {
  it('prefixes the season directory', () => {
    expect(buildPlexEpisodeRelPath(3, 1, 'Pups Save a Blimp', '.mp4')).toBe(
      'Paw Patrol/Season 3/Paw Patrol - S03E01 - Pups Save a Blimp.mp4',
    );
  });
});
