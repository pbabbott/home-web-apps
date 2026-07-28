'use client';

import { useState } from 'react';
import {
  Badge,
  type BadgeColor,
  OutlinedButton,
  Panel,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Th,
  Td,
  Typography,
} from '@abbottland/fui-components';
import type { VideoJob, VideoJobStatus } from './lib/video-api';

const jobStatusColor: Record<VideoJobStatus, BadgeColor> = {
  pending: 'warning',
  processing: 'secondary',
  completed: 'success',
  failed: 'error',
};

const PAGE_SIZE = 10;

// Fixed locale/timeZone so server and client render identical text — a
// locale-dependent format (e.g. toLocaleString()) mismatches across the
// SSR/hydration boundary whenever the server and browser timezones differ.
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

interface JobsClientProps {
  jobs: VideoJob[] | null;
}

export function JobsClient({ jobs }: JobsClientProps) {
  const [page, setPage] = useState(1);

  const totalPages = jobs ? Math.max(1, Math.ceil(jobs.length / PAGE_SIZE)) : 1;
  const pageJobs = jobs?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-neutral-800 p-8">
      <Typography variant="h1" component="h1">
        Video Jobs
      </Typography>

      <Panel color={jobs ? 'default' : 'error'} className="flex flex-col gap-4">
        {jobs === null && (
          <Typography variant="body1">
            Failed to load jobs from video-api.
          </Typography>
        )}
        {jobs?.length === 0 && (
          <Typography variant="body1">No jobs yet.</Typography>
        )}
        {pageJobs && pageJobs.length > 0 && (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <Th>Operation</Th>
                  <Th>Parameters</Th>
                  <Th>Status</Th>
                  <Th>Attempts</Th>
                  <Th>Result</Th>
                  <Th>Created</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageJobs.map((job) => (
                  <TableRow key={job.id}>
                    <Td>{job.operation}</Td>
                    <Td>{JSON.stringify(job.parameters)}</Td>
                    <Td>
                      <Badge color={jobStatusColor[job.status]}>
                        {job.status}
                      </Badge>
                    </Td>
                    <Td>{job.attempts}</Td>
                    <Td>{job.error ?? job.message ?? '—'}</Td>
                    <Td>{formatDate(job.createdAt)}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

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
      </Panel>
    </main>
  );
}
