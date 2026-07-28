'use client';

import {
  Badge,
  type BadgeColor,
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
        {jobs && jobs.length > 0 && (
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
              {jobs.map((job) => (
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
        )}
      </Panel>
    </main>
  );
}
