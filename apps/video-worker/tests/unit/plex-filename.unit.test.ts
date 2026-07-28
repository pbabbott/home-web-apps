import {
  buildPlexEpisodeFilename,
  buildPlexEpisodeRelPath,
  buildPlexMultiEpisodeFilename,
  buildPlexMultiEpisodeRelPath,
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

describe('buildPlexMultiEpisodeFilename', () => {
  it('builds the sXXeYY-eZZ multi-episode pattern with both titles joined', () => {
    expect(
      buildPlexMultiEpisodeFilename(
        3,
        18,
        19,
        'Pups Save a Goldrush',
        'Pups Save a Space Alien',
        '.mp4',
      ),
    ).toBe(
      'Paw Patrol - S03E18-E19 - Pups Save a Goldrush & Pups Save a Space Alien.mp4',
    );
  });

  it('strips filesystem-illegal characters from both titles', () => {
    expect(
      buildPlexMultiEpisodeFilename(
        3,
        18,
        19,
        'Pups: Save "the" Blimp',
        'Pups/Save?the Alien',
        '.mp4',
      ),
    ).toBe(
      'Paw Patrol - S03E18-E19 - Pups Save the Blimp & PupsSavethe Alien.mp4',
    );
  });
});

describe('buildPlexMultiEpisodeRelPath', () => {
  it('prefixes the season directory', () => {
    expect(
      buildPlexMultiEpisodeRelPath(
        3,
        18,
        19,
        'Pups Save a Goldrush',
        'Pups Save a Space Alien',
        '.mp4',
      ),
    ).toBe(
      'Paw Patrol/Season 3/Paw Patrol - S03E18-E19 - Pups Save a Goldrush & Pups Save a Space Alien.mp4',
    );
  });
});
