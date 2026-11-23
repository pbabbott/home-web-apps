import type { FilterAuditEntry } from '../lib/budget-api';

type Status = FilterAuditEntry['status'];

const STATUS_RANK: Record<Status, number> = {
  unchanged: -1,
  applied: 0,
  skipped_conflict: 1,
  failed: 2,
};

export interface AuditGroup {
  key: string;
  appliedAt: string;
  /** Any entry of the group; transaction and rule fields are shared. */
  base: FilterAuditEntry;
  categorize?: FilterAuditEntry;
  approve?: FilterAuditEntry;
  /** Worst status across the group's rows. */
  status: Status;
}

/**
 * Merge per-action audit rows (categorize / approve) into one group per
 * transaction per job. Input order (newest first) is preserved by first
 * appearance.
 */
export function groupAuditEntries(entries: FilterAuditEntry[]): AuditGroup[] {
  const groups = new Map<string, AuditGroup>();
  for (const e of entries) {
    const key = `${e.planId}:${e.transactionId}:${e.jobId ?? e.appliedAt}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, appliedAt: e.appliedAt, base: e, status: e.status };
      groups.set(key, g);
    }
    if (e.action === 'categorize') g.categorize = e;
    else g.approve = e;
    if (STATUS_RANK[e.status] > STATUS_RANK[g.status]) g.status = e.status;
  }
  return [...groups.values()];
}
