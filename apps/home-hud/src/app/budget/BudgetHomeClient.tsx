'use client';

import {
  Badge,
  Panel,
  StatusIndicator,
  TransparentPanel,
  Typography,
} from '@abbottland/fui-components';
import { Footer } from '../components/Footer';
import { LocalDate } from './lib/LocalDate';
import type {
  BudgetJob,
  YnabPlan,
  YnabSyncRun,
  YnabSyncState,
} from './lib/budget-api';
import {
  describeRun,
  formatBytes,
  groupCursorsByPlan,
  jobStatusColor,
  mostRecentBy,
  operationLabels,
  planLabel,
  recentJobStats,
} from './lib/budget-display';

interface BudgetHomeClientProps {
  jobs: BudgetJob[] | null;
  plans: YnabPlan[] | null;
  syncRuns: YnabSyncRun[] | null;
  syncState: YnabSyncState[] | null;
  workerReady: boolean;
}

export function BudgetHomeClient({
  jobs,
  plans,
  syncRuns,
  syncState,
  workerReady,
}: BudgetHomeClientProps) {
  const reachable = jobs !== null;
  const stats = recentJobStats(jobs);
  const syncJobs = (jobs ?? []).filter((j) => j.operation === 'ynab_sync');
  const lastSync = mostRecentBy(syncJobs);
  const lastSyncedAt = (syncState ?? [])
    .map((s) => s.lastSyncedAt)
    .sort()
    .at(-1);
  const syncedPlans = groupCursorsByPlan(syncState);
  const latestRun = syncRuns?.[0];

  return (
    <main className="flex min-h-screen flex-col bg-neutral-800">
      <div className="flex flex-1 flex-col gap-10 px-8 py-10">
        <div className="flex flex-col items-center gap-4">
          <Typography variant="h1" component="h1">
            Budget
          </Typography>
        </div>

        <div className="flex flex-col gap-6">
          <TransparentPanel
            color="dark"
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <Typography
              variant="h6"
              component="h2"
              className="text-neutral-400"
            >
              System Status
            </Typography>
            <ul className="m-0 w-full max-w-xs list-none p-0">
              <StatusIndicator
                color={reachable ? 'success' : 'error'}
                // A pulsing red dot would read as "alive".
                pulse={reachable}
                aria-label={`budget-api: ${reachable ? 'reachable' : 'unreachable'}`}
              >
                budget-api
              </StatusIndicator>
              <StatusIndicator
                color={workerReady ? 'success' : 'error'}
                pulse={workerReady}
                aria-label={`budget-worker: ${workerReady ? 'ready' : 'unreachable'}`}
              >
                budget-worker
              </StatusIndicator>
            </ul>
          </TransparentPanel>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Panel color="primary" className="flex h-full flex-col gap-4">
              <div className="flex items-center justify-between">
                <Typography variant="h5" component="h2">
                  Jobs
                </Typography>
                <Typography variant="h3" component="span">
                  {jobs?.length ?? '—'}
                </Typography>
              </div>

              <div className="flex items-center gap-4">
                <Typography
                  variant="h4"
                  component="span"
                  className="w-16 shrink-0 text-right"
                >
                  {stats.successRate === null
                    ? '—'
                    : `${Math.round(stats.successRate)}%`}
                </Typography>
                <div className="flex items-center gap-2">
                  <Badge color="success">{stats.successCount} ok</Badge>
                  <Badge color="error">{stats.failedCount} failed</Badge>
                  <Typography variant="caption" className="text-neutral-400">
                    last {stats.sampleSize}
                  </Typography>
                </div>
              </div>

              <div className="mt-auto flex flex-col gap-1 border-t border-neutral-50/20 pt-3">
                <Typography variant="small" className="text-neutral-300">
                  Last YNAB Sync
                </Typography>
                {lastSync ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge color={jobStatusColor[lastSync.status]}>
                        {lastSync.status}
                      </Badge>
                      <Typography
                        variant="caption"
                        className="text-neutral-300"
                      >
                        <LocalDate iso={lastSync.createdAt} />
                      </Typography>
                    </div>
                    <Typography variant="body2" className="truncate">
                      {lastSync.error ?? lastSync.message ?? '—'}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" className="text-neutral-300">
                    No {operationLabels.ynab_sync} jobs yet
                  </Typography>
                )}
              </div>
            </Panel>

            <Panel color="accent-falcon" className="flex h-full flex-col gap-4">
              <div className="flex items-center justify-between">
                <Typography variant="h5" component="h2">
                  YNAB Data
                </Typography>
                <Typography variant="h3" component="span">
                  {syncRuns?.length ?? '—'}
                </Typography>
              </div>

              <div className="flex flex-wrap gap-2">
                {syncedPlans.map((p) => (
                  <Badge key={p.planId} color="dark">
                    {planLabel(plans, p.planId)}
                  </Badge>
                ))}
                {latestRun && (
                  <Badge color="dark">
                    latest run {formatBytes(latestRun.totalBytes)}
                  </Badge>
                )}
              </div>

              <div className="mt-auto flex flex-col gap-1 border-t border-neutral-50/20 pt-3">
                <Typography variant="small" className="text-neutral-300">
                  Last Synced
                </Typography>
                <Typography variant="body2">
                  {lastSyncedAt ? <LocalDate iso={lastSyncedAt} /> : 'Never'}
                </Typography>
                {latestRun && (
                  <Typography variant="caption" className="text-neutral-300">
                    {describeRun(latestRun)}
                  </Typography>
                )}
              </div>
            </Panel>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
