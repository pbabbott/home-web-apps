'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  Badge,
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
import type { Host } from '../../infra/hosts/lib/homelab-api';
import { JOB_STATUS_COLOR, formatDateTime } from '../lib/job-display';
import type {
  Source,
  DiscoveryJobWithSource,
} from '../sources/lib/homelab-api';

/** While any job is active the page re-fetches this often, so progress shows without a manual reload. */
const ACTIVE_REFRESH_MS = 5000;

function buildUrl(sourceId: string | null): string {
  return sourceId ? `/exodus/jobs?source=${sourceId}` : '/exodus/jobs';
}

interface JobsClientProps {
  jobs: DiscoveryJobWithSource[] | null;
  sources: Source[] | null;
  hosts: Host[] | null;
  selectedSourceId: string | null;
  hasActiveJob: boolean;
}

export function JobsClient({
  jobs,
  sources,
  hosts,
  selectedSourceId,
  hasActiveJob,
}: JobsClientProps) {
  const router = useRouter();

  useEffect(() => {
    if (!hasActiveJob) return;

    const timer = setInterval(() => router.refresh(), ACTIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [hasActiveJob, router]);

  const hostsById = new Map((hosts ?? []).map((host) => [host.id, host]));

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
      <Typography variant="h1" component="h1">
        Discovery Jobs
      </Typography>

      <Panel color="default" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Typography variant="body2" className="text-neutral-400">
            Discovery runs across all sources, newest first.
          </Typography>

          <label className="flex items-center gap-2">
            <Typography variant="small" className="text-neutral-400">
              Source
            </Typography>
            <select
              value={selectedSourceId ?? ''}
              disabled={sources === null}
              onChange={(e) => router.push(buildUrl(e.target.value || null))}
              className="border border-neutral-300 bg-neutral-600 px-2 py-1.5 text-neutral-50 focus:outline-none focus:ring-0"
            >
              <option value="">All sources</option>
              {(sources ?? []).map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {jobs === null ? (
          <Typography variant="body2" className="text-error-400">
            Failed to load discovery jobs from homelab-api.
          </Typography>
        ) : jobs.length === 0 ? (
          <Typography variant="body2" className="text-neutral-400">
            {selectedSourceId
              ? 'No discovery jobs for this source.'
              : 'No discovery jobs yet.'}
          </Typography>
        ) : (
          <ScrollableTable className="mb-0">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <Th>Status</Th>
                  <Th>Source</Th>
                  <Th>Host</Th>
                  <Th>Root</Th>
                  <Th>Created (UTC)</Th>
                  <Th>Finished (UTC)</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.map((job) => {
                  const host = job.hostId
                    ? hostsById.get(job.hostId)
                    : undefined;

                  return (
                    <TableRow key={job.id}>
                      <Td>
                        <Link
                          href={`/exodus/jobs/${job.id}`}
                          className="hover:underline"
                        >
                          <Badge color={JOB_STATUS_COLOR[job.status]}>
                            {job.status}
                          </Badge>
                        </Link>
                      </Td>
                      <Td>
                        <Link
                          href={`/exodus/sources/${job.sourceId}`}
                          className="text-primary-400 hover:underline"
                        >
                          {job.sourceName}
                        </Link>
                      </Td>
                      <Td>{host ? host.name : '—'}</Td>
                      <Td className="break-all">
                        <Link
                          href={`/exodus/jobs/${job.id}`}
                          className="text-primary-400 hover:underline"
                        >
                          {job.rootPath}
                        </Link>
                      </Td>
                      <Td>{formatDateTime(job.createdAt)}</Td>
                      <Td>{formatDateTime(job.finishedAt)}</Td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollableTable>
        )}
      </Panel>
    </main>
  );
}
