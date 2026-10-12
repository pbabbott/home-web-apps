import {
  buildPlexEpisodeFilename,
  buildPlexEpisodeRelPath,
  extractQualityTag,
} from '../../src/worker/operations/file-suggestions/lib/plex-filename';

describe('extractQualityTag', () => {
  it('extracts an HDTV tag', () => {
    expect(extractQualityTag('Paw.Patrol.S03E01.HDTV-720p.mkv')).toBe(
      'HDTV-720p',
    );
  });

  it('extracts a WEBDL tag', () => {
    expect(extractQualityTag('Paw.Patrol.S03E01.WEBDL-1080p.mp4')).toBe(
      'WEBDL-1080p',
    );
  });

  it('returns null when no quality tag is present', () => {
    expect(extractQualityTag('random-name.mp4')).toBeNull();
  });
});

describe('buildPlexEpisodeFilename', () => {
  it('pads season/episode numbers to 2 digits', () => {
    expect(
      buildPlexEpisodeFilename(
        'Paw Patrol',
        3,
        1,
        'Pups Save a Blimp',
        null,
        '.mp4',
      ),
    ).toBe('Paw Patrol - S03E01 - Pups Save a Blimp.mp4');
  });

  it('handles double-digit season/episode numbers', () => {
    expect(
      buildPlexEpisodeFilename('Paw Patrol', 12, 34, 'Title', null, '.mkv'),
    ).toBe('Paw Patrol - S12E34 - Title.mkv');
  });

  it('strips filesystem-illegal characters from the title', () => {
    expect(
      buildPlexEpisodeFilename(
        'Paw Patrol',
        3,
        1,
        'Pups: Save/the "Blimp"?',
        null,
        '.mp4',
      ),
    ).toBe('Paw Patrol - S03E01 - Pups Savethe Blimp.mp4');
  });

  it('appends a bracketed quality tag when given one', () => {
    expect(
      buildPlexEpisodeFilename(
        'Paw Patrol',
        3,
        1,
        'Pups Save a Blimp',
        'WEBDL-1080p',
        '.mp4',
      ),
    ).toBe('Paw Patrol - S03E01 - Pups Save a Blimp [WEBDL-1080p].mp4');
  });

  it('uses the display name even when it differs from the on-disk directory name', () => {
    expect(
      buildPlexEpisodeFilename(
        'SpongeBob SquarePants',
        3,
        1,
        'Title',
        null,
        '.mp4',
      ),
    ).toBe('SpongeBob SquarePants - S03E01 - Title.mp4');
  });
});

describe('buildPlexEpisodeRelPath', () => {
  it('prefixes the season directory', () => {
    expect(
      buildPlexEpisodeRelPath(
        'Paw Patrol',
        'Paw Patrol',
        3,
        1,
        'Pups Save a Blimp',
        null,
        '.mp4',
      ),
    ).toBe(
      'media/tv_shows/Paw Patrol/Season 3/Paw Patrol - S03E01 - Pups Save a Blimp.mp4',
    );
  });

  it('carries the quality tag through', () => {
    expect(
      buildPlexEpisodeRelPath(
        'Paw Patrol',
        'Paw Patrol',
        3,
        1,
        'Pups Save a Blimp',
        'HDTV-720p',
        '.mp4',
      ),
    ).toBe(
      'media/tv_shows/Paw Patrol/Season 3/Paw Patrol - S03E01 - Pups Save a Blimp [HDTV-720p].mp4',
    );
  });

  it('uses the directory name for the path and the display name for the filename when they differ', () => {
    expect(
      buildPlexEpisodeRelPath(
        'spongebob_squarepants',
        'SpongeBob SquarePants',
        3,
        1,
        'Title',
        null,
        '.mp4',
      ),
    ).toBe(
      'media/tv_shows/spongebob_squarepants/Season 3/SpongeBob SquarePants - S03E01 - Title.mp4',
    );
  });
});
