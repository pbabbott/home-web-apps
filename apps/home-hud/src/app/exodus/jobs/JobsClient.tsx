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
import { JOB_STATUS_COLOR, formatDuration } from '../lib/job-display';
import { JobActivity, JobPhaseBadge, JobProgress } from '../lib/JobSummary';
import { LocalDateTime } from '../lib/LocalDateTime';
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
  selectedSourceId: string | null;
  hasActiveJob: boolean;
}

export function JobsClient({
  jobs,
  sources,
  selectedSourceId,
  hasActiveJob,
}: JobsClientProps) {
  const router = useRouter();

  useEffect(() => {
    if (!hasActiveJob) return;

    const timer = setInterval(() => router.refresh(), ACTIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [hasActiveJob, router]);

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
            <Typography variant="body2" className="text-neutral-400">
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
                  <Th>ID</Th>
                  <Th>Root</Th>
                  <Th>Status</Th>
                  <Th>Progress</Th>
                  <Th>Last activity</Th>
                  <Th>Source</Th>
                  <Th>Created</Th>
                  <Th>Finished</Th>
                  <Th>Duration</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.map((job) => {
                  return (
                    <TableRow key={job.id}>
                      <Td>
                        <Link
                          href={`/exodus/jobs/${job.id}`}
                          className="hover:underline"
                        >
                          <Typography
                            variant="body2"
                            component="span"
                            className="text-primary-400"
                          >
                            {job.id.slice(0, 8)}
                          </Typography>
                        </Link>
                      </Td>
                      <Td className="break-all">
                        <Link
                          href={`/exodus/jobs/${job.id}`}
                          className="text-primary-400 hover:underline"
                        >
                          {job.rootPath}
                        </Link>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge color={JOB_STATUS_COLOR[job.status]}>
                            {job.status}
                          </Badge>
                          <JobPhaseBadge job={job} />
                        </div>
                      </Td>
                      <Td>
                        <JobProgress job={job} />
                      </Td>
                      <Td>
                        <JobActivity job={job} />
                      </Td>
                      <Td>
                        <Link
                          href={`/exodus/sources/${job.sourceId}`}
                          className="text-primary-400 hover:underline"
                        >
                          {job.sourceName}
                        </Link>
                      </Td>
                      <Td>
                        <LocalDateTime iso={job.createdAt} />
                      </Td>
                      <Td>
                        <LocalDateTime iso={job.finishedAt} />
                      </Td>
                      <Td>{formatDuration(job.createdAt, job.finishedAt)}</Td>
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
