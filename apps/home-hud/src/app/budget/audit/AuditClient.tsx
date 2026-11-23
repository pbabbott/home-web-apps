'use client';

import { useState } from 'react';
import {
  Badge,
  type BadgeColor,
  OutlinedButton,
  ScrollableTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
  Typography,
} from '@abbottland/fui-components';
import { useRouter } from 'next/navigation';
import { LocalDate } from '../lib/LocalDate';
import type { FilterAuditEntry } from '../lib/budget-api';
import { formatUnits } from '../lib/budget-display';

const statusColor: Record<FilterAuditEntry['status'], BadgeColor> = {
  applied: 'success',
  skipped_conflict: 'warning',
  failed: 'error',
};

const PAGE_SIZE = 25;

export function AuditClient({
  entries,
}: {
  entries: FilterAuditEntry[] | null;
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil((entries?.length ?? 0) / PAGE_SIZE));
  const rows = entries?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-neutral-800 p-8">
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
          <ScrollableTable>
            <Table>
              <TableHead>
                <TableRow>
                  <Th>When</Th>
                  <Th>Transaction</Th>
                  <Th>Action</Th>
                  <Th>Change</Th>
                  <Th>Why (rule at the time)</Th>
                  <Th>Status</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.id}>
                    <Td>
                      <LocalDate iso={e.appliedAt} />
                    </Td>
                    <Td>
                      {e.transactionDate} · {e.payeeName ?? '—'} ·{' '}
                      {formatUnits(e.transactionAmount / 1000)}
                      <br />
                      <span className="text-neutral-400">
                        {e.accountName ?? ''}
                      </span>
                    </Td>
                    <Td>{e.action}</Td>
                    <Td>
                      {e.fromValue ?? '—'} → {e.toValue ?? '—'}
                    </Td>
                    <Td>
                      {e.ruleDescription}
                      {e.error && (
                        <>
                          <br />
                          <span className="text-red-400">{e.error}</span>
                        </>
                      )}
                    </Td>
                    <Td>
                      <Badge color={statusColor[e.status]}>
                        {e.status.replace('_', ' ')}
                      </Badge>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTable>
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
    </main>
  );
}
