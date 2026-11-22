'use client';

import { Fragment, useState } from 'react';
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
import type {
  YnabPlan,
  YnabRawResponseSummary,
  YnabSyncRun,
  YnabSyncState,
} from '../lib/budget-api';
import {
  describeRun,
  formatBytes,
  formatDate,
  groupCursorsByPlan,
  PLAN_ENDPOINT_ORDER,
  planLabel,
  responseKind,
  shortId,
} from '../lib/budget-display';

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

interface YnabClientProps {
  plans: YnabPlan[] | null;
  syncState: YnabSyncState[] | null;
  syncRuns: YnabSyncRun[] | null;
  rawResponses: YnabRawResponseSummary[] | null;
}

export function YnabClient({
  plans,
  syncState,
  syncRuns,
  rawResponses,
}: YnabClientProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const planRows = groupCursorsByPlan(syncState);

  return (
    <main className="flex min-h-screen flex-col gap-10 bg-neutral-800 p-8">
      <Typography variant="h1" component="h1">
        YNAB Data
      </Typography>

      <div className="flex max-w-3xl flex-col gap-2">
        <Typography variant="body2" className="text-neutral-400">
          Each sync asks YNAB for a plan’s accounts, categories, months, payees,
          scheduled transactions and transactions, and stores every answer
          as-is. The first sync is a full download; after that YNAB only sends
          what changed, so later syncs are tiny.
        </Typography>
        <Typography variant="body2" className="text-neutral-400">
          Only metadata is shown here. The stored data itself is personal
          financial data and is never displayed.
        </Typography>
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
            Nothing synced yet. Run a YNAB sync from the Jobs page.
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
                          {state ? formatDate(state.lastSyncedAt) : '—'}
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
          Sync runs
        </Typography>
        {syncRuns === null && (
          <Typography variant="body1" className="text-error-400">
            Failed to load sync runs from budget-api.
          </Typography>
        )}
        {syncRuns?.length === 0 && (
          <Typography variant="body1">No sync runs yet.</Typography>
        )}
        {syncRuns && syncRuns.length > 0 && (
          <ScrollableTable className="mb-0">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <Th>Started</Th>
                  <Th>What was stored</Th>
                  <Th>Size</Th>
                  <Th>Job</Th>
                  <Th>Details</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {syncRuns.map((run) => {
                  const key = run.jobId ?? run.startedAt;
                  const isOpen = expanded.has(key);
                  const responses = (rawResponses ?? []).filter(
                    (r) => r.jobId === run.jobId,
                  );

                  return (
                    <Fragment key={key}>
                      <TableRow>
                        <Td>{formatDate(run.startedAt)}</Td>
                        <Td>{describeRun(run)}</Td>
                        <Td>{formatBytes(run.totalBytes)}</Td>
                        <Td>{shortId(run.jobId)}</Td>
                        <Td>
                          <OutlinedButton
                            size="small"
                            onClick={() => toggle(key)}
                          >
                            {isOpen ? 'Hide' : 'Show'}
                          </OutlinedButton>
                        </Td>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <Td colSpan={5}>
                            {responses.length === 0 ? (
                              <Typography
                                variant="caption"
                                className="text-neutral-400"
                              >
                                Individual responses for this run are no longer
                                in the recent list.
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
        )}
      </section>
    </main>
  );
}
