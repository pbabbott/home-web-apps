'use client';

import { useMemo, useState } from 'react';
import { OutlinedButton, Typography } from '@abbottland/fui-components';
import { useRouter } from 'next/navigation';
import type { FilterAuditEntry } from '../lib/budget-api';
import { AuditCard } from './AuditCard';
import { groupAuditEntries } from './group-audit-entries';

const PAGE_SIZE = 25;

export function AuditClient({
  entries,
  ruleIds,
}: {
  entries: FilterAuditEntry[] | null;
  /** Ids of rules that still exist; null if they could not be loaded. */
  ruleIds: string[] | null;
}) {
  const existingRules = new Set(ruleIds ?? []);
  const router = useRouter();
  const [page, setPage] = useState(1);
  const groups = useMemo(
    () => (entries ? groupAuditEntries(entries) : null),
    [entries],
  );
  const totalPages = Math.max(1, Math.ceil((groups?.length ?? 0) / PAGE_SIZE));
  const rows = groups?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="flex min-h-screen flex-col items-center bg-neutral-800 p-8">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <Typography variant="h1" component="h1">
          Audit Log
        </Typography>

        <Typography variant="body2" className="max-w-3xl text-neutral-400">
          Every automatic action taken by a filter rule, newest first. The rule
          text is frozen as it was when the action happened, so editing or
          deleting a rule later never changes this history.
        </Typography>

        <div>
          <OutlinedButton size="small" onClick={() => router.refresh()}>
            Refresh
          </OutlinedButton>
        </div>

        {rows === undefined || entries === null ? (
          <Typography variant="body2" className="text-red-400">
            Could not load the audit log from budget-api.
          </Typography>
        ) : entries.length === 0 ? (
          <Typography variant="body2" className="text-neutral-400">
            Nothing has been applied yet.
          </Typography>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {rows.map((g) => (
                <AuditCard
                  key={g.key}
                  group={g}
                  ruleExists={
                    !!g.base.filterSelectionId &&
                    existingRules.has(g.base.filterSelectionId)
                  }
                  rulesLoaded={ruleIds !== null}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <OutlinedButton
                  size="small"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </OutlinedButton>
                <Typography variant="body2">
                  Page {page} of {totalPages}
                </Typography>
                <OutlinedButton
                  size="small"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </OutlinedButton>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
