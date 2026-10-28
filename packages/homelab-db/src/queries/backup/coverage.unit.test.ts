import {
  BLOCKING_BACKUP_COVERAGE_BUCKETS,
  classifyBackupCoverage,
  type BackupCoverageFacts,
} from './coverage';

const base: BackupCoverageFacts = {
  decision: 'approved',
  excludedByRule: false,
  verified: false,
  redundantCovered: false,
  activeWork: false,
  latestOutcome: null,
};

describe('classifyBackupCoverage', () => {
  it('puts a rejected item in rejected, whatever else is true', () => {
    expect(
      classifyBackupCoverage({ ...base, decision: 'rejected', verified: true }),
    ).toBe('rejected');
  });

  it('puts a pending decision in undecided', () => {
    expect(classifyBackupCoverage({ ...base, decision: 'pending' })).toBe(
      'undecided',
    );
  });

  it('keeps a verified item covered after a later failure', () => {
    expect(
      classifyBackupCoverage({
        ...base,
        verified: true,
        latestOutcome: 'failed',
      }),
    ).toBe('covered');
  });

  it('puts a nested item whose covering item verified it in redundant_covered', () => {
    expect(classifyBackupCoverage({ ...base, redundantCovered: true })).toBe(
      'redundant_covered',
    );
  });

  it('puts an approved item under an exclusion rule in excluded_rule', () => {
    expect(classifyBackupCoverage({ ...base, excludedByRule: true })).toBe(
      'excluded_rule',
    );
  });

  it('prefers pending over an older failure', () => {
    expect(
      classifyBackupCoverage({
        ...base,
        activeWork: true,
        latestOutcome: 'failed',
      }),
    ).toBe('pending');
  });

  it.each(['failed', 'blocked'] as const)(
    'reports a latest %s outcome',
    (o) => {
      expect(classifyBackupCoverage({ ...base, latestOutcome: o })).toBe(o);
    },
  );

  it('puts an untouched approved item in never_attempted', () => {
    expect(classifyBackupCoverage(base)).toBe('never_attempted');
  });

  it('blocks allAccounted for exactly the unresolved buckets', () => {
    expect([...BLOCKING_BACKUP_COVERAGE_BUCKETS].sort()).toEqual(
      ['blocked', 'failed', 'never_attempted', 'pending', 'undecided'].sort(),
    );
  });
});
