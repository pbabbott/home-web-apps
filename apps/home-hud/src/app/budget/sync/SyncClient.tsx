'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  type BadgeColor,
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
import { LocalDate } from '../lib/LocalDate';
import { createJob, type BudgetJobRequest } from '../lib/actions';
import type {
  BudgetJob,
  YnabPlan,
  YnabRawResponseSummary,
  YnabSyncRun,
  YnabSyncState,
} from '../lib/budget-api';
import {
  describeRun,
  formatBytes,
  groupCursorsByPlan,
  jobStatusColor,
  joinSyncJobs,
  PLAN_ENDPOINT_ORDER,
  planLabel,
  responseKind,
  syncJobType,
} from '../lib/budget-display';

const PAGE_SIZE = 10;

const FULL_SYNC_WARNING =
  'A full sync re-downloads the configured plan from scratch (7 of YNAB’s 200 requests/hour and a lot of stored data). Continue?';

const REBUILD_WARNING =
  'Rebuild deletes the typed YNAB tables and re-creates them from the stored raw responses. It makes no YNAB API calls. Continue?';

const kindColor: Record<ReturnType<typeof responseKind>, BadgeColor> = {
  snapshot: 'warning',
  delta: 'success',
  list: 'dark',
};

const kindLabel: Record<ReturnType<typeof responseKind>, string> = {
  snapshot: 'full download',
  delta: 'update',
  list: 'plan list',
};

interface SyncClientProps {
  jobs: BudgetJob[] | null;
  plans: YnabPlan[] | null;
  syncState: YnabSyncState[] | null;
  syncRuns: YnabSyncRun[] | null;
  rawResponses: YnabRawResponseSummary[] | null;
}

export function SyncClient({
  jobs,
  plans,
  syncState,
  syncRuns,
  rawResponses,
}: SyncClientProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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

  const planRows = groupCursorsByPlan(syncState);
  const syncJobs = jobs === null ? null : joinSyncJobs(jobs, syncRuns);
  const totalPages = syncJobs
    ? Math.max(1, Math.ceil(syncJobs.length / PAGE_SIZE))
    : 1;
  const pageRows = syncJobs?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="flex min-h-screen flex-col gap-10 bg-neutral-800 p-8">
      <Typography variant="h1" component="h1">
        YNAB Sync
      </Typography>

      <div className="flex max-w-3xl flex-col gap-2">
        <Typography variant="body2" className="text-neutral-400">
          Each sync asks YNAB for a plan’s accounts, categories, months, payees,
          scheduled transactions and transactions, and stores every answer
          as-is. The first sync is a full download; after that YNAB only sends
          what changed, so later syncs are tiny.
        </Typography>
        <Typography variant="body2" className="text-neutral-400">
          A transform turns the stored responses into queryable tables without
          calling YNAB (a sync starts one automatically). Rebuild recreates the
          tables from scratch.
        </Typography>
        <Typography variant="body2" className="text-neutral-400">
          Only metadata is shown here. The stored data itself is personal
          financial data and is never displayed.
        </Typography>
      </div>

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
            onClick={() => void start({ operation: 'ynab_transform' })}
          >
            Run transform
          </OutlinedButton>
          <OutlinedButton
            size="small"
            disabled={submitting}
            onClick={() => {
              if (window.confirm(REBUILD_WARNING)) {
                void start({ operation: 'ynab_transform', rebuild: true });
              }
            }}
          >
            Rebuild tables
          </OutlinedButton>
          <OutlinedButton
            size="small"
            color="secondary"
            onClick={() => router.refresh()}
          >
            Refresh
          </OutlinedButton>
        </div>
        {submitError && (
          <Typography variant="body2" className="text-error-400">
            {submitError}
          </Typography>
        )}
      </div>

      <section className="flex flex-col gap-4">
        <Typography variant="h5" component="h2">
          Sync status
        </Typography>
        {syncState === null && (
          <Typography variant="body1" className="text-error-400">
            Failed to load sync state from budget-api.
          </Typography>
        )}
        {syncState?.length === 0 && (
          <Typography variant="body1">
            Nothing synced yet. Run a YNAB sync above.
          </Typography>
        )}
        {planRows.length > 0 && (
          <ScrollableTable className="mb-0">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <Th>Plan</Th>
                  {PLAN_ENDPOINT_ORDER.map((endpoint) => (
                    <Th key={endpoint}>{endpoint.replace('_', ' ')}</Th>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {planRows.map((row) => (
                  <TableRow key={row.planId}>
                    <Td>{planLabel(plans, row.planId)}</Td>
                    {PLAN_ENDPOINT_ORDER.map((endpoint) => {
                      const state = row.byEndpoint[endpoint];

                      return (
                        <Td key={endpoint}>
                          {state ? <LocalDate iso={state.lastSyncedAt} /> : '—'}
                        </Td>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTable>
        )}
        {planRows.length > 0 && (
          <Typography variant="caption" className="text-neutral-400">
            Each cell is when that data was last synced.
          </Typography>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <Typography variant="h5" component="h2">
          Runs
        </Typography>
        {syncJobs === null && (
          <Typography variant="body1" className="text-error-400">
            Failed to load jobs from budget-api.
          </Typography>
        )}
        {syncJobs?.length === 0 && (
          <Typography variant="body1">No sync runs yet.</Typography>
        )}
        {pageRows && pageRows.length > 0 && (
          <>
            <ScrollableTable className="mb-0">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <Th>Started</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th>Result</Th>
                    <Th>What was stored</Th>
                    <Th>Size</Th>
                    <Th>Details</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pageRows.map(({ job, run }) => {
                    const isOpen = expanded.has(job.id);
                    const responses = (rawResponses ?? []).filter(
                      (r) => r.jobId === job.id,
                    );

                    return (
                      <Fragment key={job.id}>
                        <TableRow>
                          <Td>
                            <LocalDate iso={job.createdAt} />
                          </Td>
                          <Td>{syncJobType(job)}</Td>
                          <Td>
                            <Badge color={jobStatusColor[job.status]}>
                              {job.status}
                            </Badge>
                          </Td>
                          <Td>{job.error ?? job.message ?? '—'}</Td>
                          <Td>{run ? describeRun(run) : '—'}</Td>
                          <Td>{run ? formatBytes(run.totalBytes) : '—'}</Td>
                          <Td>
                            {run && (
                              <OutlinedButton
                                size="small"
                                onClick={() => toggle(job.id)}
                              >
                                {isOpen ? 'Hide' : 'Show'}
                              </OutlinedButton>
                            )}
                          </Td>
                        </TableRow>
                        {isOpen && (
                          <TableRow>
                            <Td colSpan={7}>
                              {responses.length === 0 ? (
                                <Typography
                                  variant="caption"
                                  className="text-neutral-400"
                                >
                                  Individual responses for this run are no
                                  longer in the recent list.
                                </Typography>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  {responses.map((r) => {
                                    const kind = responseKind(r);

                                    return (
                                      <div
                                        key={r.id}
                                        className="flex flex-wrap items-center gap-3"
                                      >
                                        <Typography
                                          variant="small"
                                          className="w-52"
                                        >
                                          {r.endpoint}
                                        </Typography>
                                        <Badge color={kindColor[kind]}>
                                          {kindLabel[kind]}
                                        </Badge>
                                        <Typography
                                          variant="caption"
                                          className="text-neutral-400"
                                        >
                                          {formatBytes(r.payloadBytes)}
                                          {r.serverKnowledgeReturned !== null &&
                                            ` · up to change #${r.serverKnowledgeReturned}`}
                                        </Typography>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </Td>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
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
      </section>
    </main>
  );
}
