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
import type {
  FileRename,
  FileRenameStatus,
  VideoJob,
  VideoJobStatus,
} from './lib/video-api';

const jobStatusColor: Record<VideoJobStatus, BadgeColor> = {
  pending: 'warning',
  processing: 'secondary',
  completed: 'success',
  failed: 'error',
};

const fileRenameStatusColor: Record<FileRenameStatus, BadgeColor> = {
  pending: 'warning',
  applied: 'success',
  rejected: 'error',
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

interface TvShowCleanupClientProps {
  jobs: VideoJob[] | null;
  fileRenames: FileRename[] | null;
}

export function TvShowCleanupClient({
  jobs,
  fileRenames,
}: TvShowCleanupClientProps) {
  return (
    <main className="flex min-h-screen flex-col gap-8 bg-neutral-800 p-8">
      <Typography variant="h1" component="h1">
        TV Show Cleanup
      </Typography>

      <Panel color={jobs ? 'default' : 'error'} className="flex flex-col gap-4">
        <Typography variant="h4" component="h2">
          Processing Jobs
        </Typography>
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
                <Th>Input Path</Th>
                <Th>Status</Th>
                <Th>Attempts</Th>
                <Th>Created</Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <Td>{job.operation}</Td>
                  <Td>{job.inputPath}</Td>
                  <Td>
                    <Badge color={jobStatusColor[job.status]}>
                      {job.status}
                    </Badge>
                  </Td>
                  <Td>{job.attempts}</Td>
                  <Td>{formatDate(job.createdAt)}</Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Panel
        color={fileRenames ? 'default' : 'error'}
        className="flex flex-col gap-4"
      >
        <Typography variant="h4" component="h2">
          Rename Suggestions
        </Typography>
        {fileRenames === null && (
          <Typography variant="body1">
            Failed to load rename suggestions from video-api.
          </Typography>
        )}
        {fileRenames?.length === 0 && (
          <Typography variant="body1">No rename suggestions yet.</Typography>
        )}
        {fileRenames && fileRenames.length > 0 && (
          <Table>
            <TableHead>
              <TableRow>
                <Th>Original Path</Th>
                <Th>Suggested Path</Th>
                <Th>Status</Th>
                <Th>Created</Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {fileRenames.map((fileRename) => (
                <TableRow key={fileRename.id}>
                  <Td>{fileRename.originalFilePath}</Td>
                  <Td>{fileRename.suggestedFilePath}</Td>
                  <Td>
                    <Badge color={fileRenameStatusColor[fileRename.status]}>
                      {fileRename.status}
                    </Badge>
                  </Td>
                  <Td>{formatDate(fileRename.createdAt)}</Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </main>
  );
}
