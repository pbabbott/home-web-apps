import type { KnownSkip, NestedInventoryItem } from '@abbottland/homelab-db';
import {
  pickBearingSkip,
  resolveCoverageStatus,
} from '../../src/services/discovery/path-coverage';

const item = (
  rootPath: string,
  decision: NestedInventoryItem['decision'],
): NestedInventoryItem => ({
  id: rootPath,
  kind: 'directory',
  rootPath,
  displayName: rootPath,
  recommendation: 'back_up',
  decision,
});

describe('resolveCoverageStatus', () => {
  it('is uncovered with no items', () => {
    expect(resolveCoverageStatus(null, [])).toEqual({
      status: 'uncovered',
      decidingItem: null,
    });
  });

  it('is covered by an approved ancestor', () => {
    const a = item('C:\\a', 'approved');

    expect(resolveCoverageStatus(null, [a])).toEqual({
      status: 'covered',
      decidingItem: a,
    });
  });

  it('is a carve-out when the nearest decision rejects inside an approval', () => {
    const outer = item('C:\\a', 'approved');
    const inner = item('C:\\a\\b', 'rejected');

    expect(resolveCoverageStatus(null, [outer, inner])).toEqual({
      status: 'carved_out',
      decidingItem: inner,
    });
  });

  it('is rejected when nothing above approves', () => {
    const a = item('C:\\a', 'rejected');

    expect(resolveCoverageStatus(null, [a]).status).toBe('rejected');
  });

  it('lets a nearer approval win over a farther rejection', () => {
    const outer = item('C:\\a', 'rejected');
    const inner = item('C:\\a\\b', 'approved');

    expect(resolveCoverageStatus(null, [outer, inner]).status).toBe('covered');
  });

  it('skips pending items to find a decision', () => {
    const outer = item('C:\\a', 'approved');
    const inner = item('C:\\a\\b', 'pending');

    expect(resolveCoverageStatus(null, [outer, inner]).decidingItem).toBe(
      outer,
    );
  });

  it('is pending when items exist but none is decided', () => {
    const exact = item('C:\\a\\b', 'pending');

    expect(resolveCoverageStatus(exact, [item('C:\\a', 'pending')])).toEqual({
      status: 'pending',
      decidingItem: exact,
    });
  });

  it('prefers the exact item over its ancestors', () => {
    const exact = item('C:\\a\\b', 'rejected');

    expect(
      resolveCoverageStatus(exact, [item('C:\\a', 'approved')]).status,
    ).toBe('carved_out');
  });
});

describe('pickBearingSkip', () => {
  const skip = (
    path: string,
    skippedAt: string,
    extra: Partial<KnownSkip> = {},
  ): KnownSkip => ({
    path,
    reason: 'r',
    skippedAt: new Date(skippedAt),
    jobId: 'j',
    ...extra,
  });

  it('picks the deepest path skip at or above the path', () => {
    const outer = skip('C:\\a', '2026-01-01');
    const inner = skip('C:\\a\\b', '2026-01-01');

    expect(pickBearingSkip([outer, inner], 'c:\\a\\b\\c')).toBe(inner);
  });

  it('ignores a skip beneath or beside the path', () => {
    expect(
      pickBearingSkip([skip('C:\\a\\b\\c', '2026-01-01')], 'c:\\a\\b'),
    ).toBeNull();
    expect(pickBearingSkip([skip('C:\\a2', '2026-01-01')], 'c:\\a\\b')).toBe(
      null,
    );
  });

  it('matches a pattern against the segment under its directory', () => {
    const msi = skip('C:\\Downloads', '2026-01-01', { pattern: '*.msi' });

    expect(pickBearingSkip([msi], 'c:\\downloads\\setup.msi')).toBe(msi);
    expect(pickBearingSkip([msi], 'c:\\downloads\\sub.msi\\deep.txt')).toBe(
      msi,
    );
    expect(pickBearingSkip([msi], 'c:\\downloads\\notes.txt')).toBeNull();
    expect(pickBearingSkip([msi], 'c:\\downloads')).toBeNull();
  });

  it('breaks a tie with the newest skip', () => {
    const old = skip('C:\\a', '2026-01-01');
    const recent = skip('C:\\a', '2026-02-01');

    expect(pickBearingSkip([old, recent], 'c:\\a\\b')).toBe(recent);
  });
});
