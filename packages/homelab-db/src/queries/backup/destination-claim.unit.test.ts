import type { BackupDestination } from '../../schema/backup';
import { chooseBackupDestination } from './destinations';

const NOW = new Date('2026-10-29T12:00:00Z');
const later = new Date('2026-10-29T12:01:00Z');
const earlier = new Date('2026-10-29T11:59:00Z');

const destination = (
  id: string,
  overrides: Partial<BackupDestination> = {},
): BackupDestination => ({
  id,
  name: id,
  connectionType: 'nfs',
  settings: { server: '192.168.4.124', exportPath: '/volume1/Dump' },
  rootDir: null,
  enabled: true,
  health: 'unknown',
  lastValidatedAt: null,
  lastValidation: null,
  validationRequestedAt: null,
  workerSeenAt: null,
  claimedBy: null,
  claimedUntil: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const options = { workerId: 'w1', leaseSeconds: 60 };

describe('chooseBackupDestination', () => {
  it('has nothing to serve before a destination is registered', () => {
    expect(chooseBackupDestination([], options, NOW)).toEqual({
      reason: 'none_registered',
    });
  });

  describe('with a mounted export', () => {
    const mount = { server: '192.168.4.124', exportPath: '/volume1/Dump' };

    it('takes the destination that is that export', () => {
      const dump = destination('dump');
      const media = destination('media', {
        settings: { server: '192.168.4.124', exportPath: '/volume1/Media' },
      });

      expect(
        chooseBackupDestination([media, dump], { ...options, mount }, NOW),
      ).toEqual({ destination: dump });
    });

    it('ignores a trailing slash on the export path', () => {
      const dump = destination('dump', {
        settings: { server: '192.168.4.124', exportPath: '/volume1/Dump/' },
      });

      expect(
        chooseBackupDestination([dump], { ...options, mount }, NOW),
      ).toEqual({ destination: dump });
    });

    it('never takes a destination that is another export', () => {
      const media = destination('media', {
        settings: { server: '192.168.4.124', exportPath: '/volume1/Media' },
      });

      expect(
        chooseBackupDestination([media], { ...options, mount }, NOW),
      ).toEqual({ reason: 'no_match' });
    });

    it('cannot tell two destinations on one export apart', () => {
      expect(
        chooseBackupDestination(
          [destination('a'), destination('b', { rootDir: 'x' })],
          { ...options, mount },
          NOW,
        ),
      ).toEqual({ reason: 'ambiguous' });
    });
  });

  describe('with a pin', () => {
    it('takes exactly that destination, whatever the mount says', () => {
      const a = destination('a');
      const b = destination('b');

      expect(
        chooseBackupDestination(
          [a, b],
          {
            ...options,
            destinationId: 'b',
            mount: { server: 'x', exportPath: '/y' },
          },
          NOW,
        ),
      ).toEqual({ destination: b });
    });

    it('finds nothing for an unknown id', () => {
      expect(
        chooseBackupDestination(
          [destination('a')],
          { ...options, destinationId: 'zzz' },
          NOW,
        ),
      ).toEqual({ reason: 'no_match' });
    });
  });

  describe('without a mount (local development)', () => {
    it('takes the only destination', () => {
      const a = destination('a');

      expect(chooseBackupDestination([a], options, NOW)).toEqual({
        destination: a,
      });
    });

    it('takes the only free one when another worker holds the rest', () => {
      const held = destination('held', {
        claimedBy: 'other',
        claimedUntil: later,
      });
      const free = destination('free');

      expect(chooseBackupDestination([held, free], options, NOW)).toEqual({
        destination: free,
      });
    });

    it('does not guess between several free destinations', () => {
      expect(
        chooseBackupDestination(
          [destination('a'), destination('b')],
          options,
          NOW,
        ),
      ).toEqual({ reason: 'ambiguous' });
    });
  });

  describe('claims', () => {
    it('is refused while another worker holds the lease', () => {
      expect(
        chooseBackupDestination(
          [destination('a', { claimedBy: 'other', claimedUntil: later })],
          options,
          NOW,
        ),
      ).toEqual({ reason: 'held_by_other' });
    });

    it('takes over an expired lease', () => {
      const a = destination('a', { claimedBy: 'other', claimedUntil: earlier });

      expect(chooseBackupDestination([a], options, NOW)).toEqual({
        destination: a,
      });
    });

    it('finds its own destination again, even with others free', () => {
      const mine = destination('mine', {
        claimedBy: 'w1',
        claimedUntil: later,
      });

      expect(
        chooseBackupDestination([destination('other'), mine], options, NOW),
      ).toEqual({ destination: mine });
    });
  });
});
