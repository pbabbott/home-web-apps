'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  OutlinedButton,
  Panel,
  ScrollableTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
  Typography,
} from '@abbottland/fui-components';
import {
  BACKUP_JOB_STATUS_COLOR,
  backupCoverageUrl,
  backupJobUrl,
  backupOverviewUrl,
  backupProgress,
  destinationStatus,
  isActiveBackupJob,
  STALLED_REASON_LABEL,
} from '../lib/backup-display';
import { LocalDateTime } from '../lib/LocalDateTime';
import {
  setBackupDestinationEnabled,
  validateBackupDestination,
} from '../sources/lib/actions';
import type { BackupDestination, BackupJob } from '../sources/lib/homelab-api';
import { BackupPicker } from './BackupPicker';
import { StartBackupModal } from './StartBackupModal';

const REFRESH_MS = 5000;

interface Props {
  sources: { id: string; name: string }[];
  destinations: BackupDestination[];
  sourceId: string | null;
  destinationId: string | null;
  /** Null if the jobs could not be loaded. */
  jobs: BackupJob[] | null;
}

export function BackupOverviewClient({
  sources,
  destinations,
  sourceId,
  destinationId,
  jobs,
}: Props) {
  const router = useRouter();
  const [startOpen, setStartOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destination = destinations.find((d) => d.id === destinationId);
  const status = destination ? destinationStatus(destination) : null;
  const hasActiveJob = jobs?.some(isActiveBackupJob) ?? false;
  const refreshing = hasActiveJob || (status?.validationPending ?? false);

  useEffect(() => {
    if (!refreshing) return;

    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refreshing, router]);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? 'Request failed');
      return;
    }

    router.refresh();
  }

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
      <div className="flex flex-col gap-2">
        <Typography variant="h1" component="h1">
          Backup
        </Typography>
        <Typography variant="body2" className="text-neutral-400">
          Copies approved inventory to an NFS destination and checks every file
          by hash.
        </Typography>
      </div>

      {!sourceId || !destination ? (
        <Typography variant="body2" className="text-neutral-400">
          {sources.length === 0
            ? 'No sources yet.'
            : 'No backup destination is registered. Register one with POST /backup-destinations on homelab-api (see the Exodus operations guide), then validate it here.'}
        </Typography>
      ) : (
        <>
          <BackupPicker
            sources={sources}
            destinations={destinations}
            sourceId={sourceId}
            destinationId={destination.id}
            urlFor={backupOverviewUrl}
          />

          <Panel color="default" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Typography variant="h5" component="h2">
                  Destination
                </Typography>
                {status && <Badge color={status.color}>{status.label}</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <OutlinedButton
                  size="small"
                  disabled={busy}
                  onClick={() =>
                    void run(() => validateBackupDestination(destination.id))
                  }
                >
                  Validate
                </OutlinedButton>
                <OutlinedButton
                  size="small"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      setBackupDestinationEnabled(
                        destination.id,
                        !destination.enabled,
                      ),
                    )
                  }
                >
                  {destination.enabled ? 'Disable' : 'Enable'}
                </OutlinedButton>
              </div>
            </div>

            <Typography variant="body2" className="break-all text-neutral-400">
              {destination.settings.server}:{destination.settings.exportPath}
              {destination.rootDir ? ` / ${destination.rootDir}` : ''}
              {' · last validated '}
              <LocalDateTime iso={destination.lastValidatedAt} />
            </Typography>

            {status?.noWorker && (
              <Typography variant="body2" className="text-warning-400">
                No worker running for this destination. Validation and copying
                wait until it is back.
              </Typography>
            )}
            {status?.validationPending && !status.noWorker && (
              <Typography variant="body2">Validation requested…</Typography>
            )}
            {status?.failedChecks.map((check) => (
              <Typography
                key={check}
                variant="body2"
                className="text-error-400"
              >
                Failed check — {check}
              </Typography>
            ))}
            {error && (
              <Typography variant="body2" className="text-error-400">
                {error}
              </Typography>
            )}
          </Panel>

          <Panel color="default" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Typography variant="h5" component="h2">
                Backup jobs
              </Typography>
              <div className="flex flex-wrap items-center gap-2">
                <OutlinedButton
                  component={Link}
                  href={backupCoverageUrl(sourceId, destination.id)}
                  color="accent-falcon"
                  size="small"
                >
                  Coverage →
                </OutlinedButton>
                <Button
                  size="small"
                  disabled={hasActiveJob || !destination.enabled}
                  onClick={() => setStartOpen(true)}
                >
                  Start backup job
                </Button>
              </div>
            </div>

            {hasActiveJob && (
              <Typography variant="body2" className="text-neutral-400">
                A job is already running for this source and destination.
              </Typography>
            )}

            {jobs === null ? (
              <Typography variant="body2" className="text-error-400">
                Failed to load backup jobs from homelab-api.
              </Typography>
            ) : jobs.length === 0 ? (
              <Typography variant="body2" className="text-neutral-400">
                No backup jobs yet for this source and destination.
              </Typography>
            ) : (
              <ScrollableTable className="mb-0">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <Th>Job</Th>
                      <Th>Status</Th>
                      <Th>Progress</Th>
                      <Th>Created</Th>
                      <Th>Finished</Th>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {jobs.map((job) => {
                      const progress = backupProgress(job.progress);

                      return (
                        <TableRow key={job.id}>
                          <Td>
                            <Link
                              href={backupJobUrl(job.id)}
                              className="text-primary-400 hover:underline"
                            >
                              {job.id.slice(0, 8)}
                            </Link>
                          </Td>
                          <Td>
                            <div className="flex flex-col gap-1">
                              <Badge
                                color={BACKUP_JOB_STATUS_COLOR[job.status]}
                              >
                                {job.status}
                              </Badge>
                              {job.stalledReason && (
                                <Typography
                                  variant="caption"
                                  className="text-warning-400"
                                >
                                  Paused:{' '}
                                  {STALLED_REASON_LABEL[job.stalledReason]}
                                </Typography>
                              )}
                            </div>
                          </Td>
                          <Td>
                            {progress.itemsDone} of {progress.itemsTotal} items
                          </Td>
                          <Td>
                            <LocalDateTime iso={job.createdAt} />
                          </Td>
                          <Td>
                            <LocalDateTime iso={job.finishedAt} />
                          </Td>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollableTable>
            )}
          </Panel>

          {startOpen && (
            <StartBackupModal
              open
              onOpenChange={setStartOpen}
              sourceId={sourceId}
              destinationId={destination.id}
            />
          )}
        </>
      )}
    </main>
  );
}
