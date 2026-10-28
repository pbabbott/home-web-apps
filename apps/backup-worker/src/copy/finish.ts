import type { BackupEntryIssueKind } from '@abbottland/homelab-db';

/** Failures a retry cannot fix: the item is blocked at once. */
const PERMANENT: BackupEntryIssueKind[] = [
  'source_missing',
  'name_too_long',
  'unsupported_path',
  'dest_conflict',
  'unlistable',
];

export type FailedEntrySummary = {
  relPath: string;
  issueKind: BackupEntryIssueKind | null;
  message: string | null;
};

/**
 * How an item with failed entries ends (§4.2 step 6). Only transient
 * failures (`read_failed`, `write_failed`, `verify_mismatch`) are retried; one
 * permanent failure blocks the item, because retrying cannot change it.
 * `total` is the number of failed entries; `sample` holds some of them.
 */
export const classifyFailures = (
  sample: FailedEntrySummary[],
  total: number,
): { kind: 'transient' | 'permanent'; error: string } => {
  const byKind = new Map<string, number>();

  for (const entry of sample) {
    const kind = entry.issueKind ?? 'unknown';

    byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
  }

  const permanent = sample.some(
    (entry) => entry.issueKind && PERMANENT.includes(entry.issueKind),
  );
  const first = sample[0];
  const kinds = [...byKind].map(([kind, n]) => `${kind} (${n})`).join(', ');
  const where = first
    ? ` First: ${first.relPath || '(item root)'}: ${first.message ?? first.issueKind}`
    : '';

  return {
    kind: permanent ? 'permanent' : 'transient',
    error:
      `${total} ${total === 1 ? 'entry' : 'entries'} failed: ${kinds}.${where}`.slice(
        0,
        1000,
      ),
  };
};
