'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Badge,
  Button,
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
import { createJob, type BudgetJobRequest } from '../lib/actions';
import type { BudgetJob } from '../lib/budget-api';
import {
  formatDate,
  jobStatusColor,
  operationLabels,
  shortId,
} from '../lib/budget-display';

const PAGE_SIZE = 10;

const FULL_SYNC_WARNING =
  'A full sync re-downloads every plan from scratch (~25 of YNAB’s 200 requests/hour and a lot of stored data). Continue?';

export function JobsClient({ jobs }: { jobs: BudgetJob[] | null }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const totalPages = jobs ? Math.max(1, Math.ceil(jobs.length / PAGE_SIZE)) : 1;
  const pageJobs = jobs?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function start(request: BudgetJobRequest) {
    setSubmitting(true);
    setSubmitError(null);

    try {
      await createJob(request);
      router.refresh();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to start job',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-neutral-800 p-8">
      <Typography variant="h1" component="h1">
        Budget Jobs
      </Typography>

      <div className="flex flex-col gap-2 self-start">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="small"
            disabled={submitting}
            onClick={() => void start({ operation: 'ynab_sync' })}
          >
            {submitting ? 'Starting…' : 'Run YNAB sync'}
          </Button>
          <OutlinedButton
            size="small"
            disabled={submitting}
            onClick={() => {
              if (window.confirm(FULL_SYNC_WARNING)) {
                void start({ operation: 'ynab_sync', full: true });
              }
            }}
          >
            Run full sync
          </OutlinedButton>
          <OutlinedButton
            size="small"
            disabled={submitting}
            onClick={() => void start({ operation: 'hello' })}
          >
            Hello
          </OutlinedButton>
          <OutlinedButton size="small" onClick={() => router.refresh()}>
            Refresh
          </OutlinedButton>
        </div>
        {submitError && (
          <Typography variant="body2" className="text-error-400">
            {submitError}
          </Typography>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {jobs === null && (
          <Typography variant="body1" className="text-error-400">
            Failed to load jobs from budget-api.
          </Typography>
        )}
        {jobs?.length === 0 && (
          <Typography variant="body1">No jobs yet.</Typography>
        )}
        {pageJobs && pageJobs.length > 0 && (
          <>
            <ScrollableTable className="mb-0">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <Th>Id</Th>
                    <Th>Operation</Th>
                    <Th>Parameters</Th>
                    <Th>Status</Th>
                    <Th>Result</Th>
                    <Th>Created</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pageJobs.map((job) => (
                    <TableRow key={job.id}>
                      <Td>{shortId(job.id)}</Td>
                      <Td>{operationLabels[job.operation] ?? job.operation}</Td>
                      <Td>{JSON.stringify(job.parameters)}</Td>
                      <Td>
                        <Badge color={jobStatusColor[job.status]}>
                          {job.status}
                        </Badge>
                      </Td>
                      <Td>{job.error ?? job.message ?? '—'}</Td>
                      <Td>{formatDate(job.createdAt)}</Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTable>

            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-4">
                <OutlinedButton
                  size="small"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </OutlinedButton>
                <Typography variant="body2">
                  Page {page} of {totalPages}
                </Typography>
                <OutlinedButton
                  size="small"
                  disabled={page === totalPages}
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
