'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Badge,
  type BadgeColor,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  OutlinedButton,
  ScrollableTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Th,
  Td,
  Typography,
} from '@abbottland/fui-components';
import { createJob, type JobOperation } from './lib/actions';
import type { AiStatus, VideoJob, VideoJobStatus } from './lib/video-api';

const jobStatusColor: Record<VideoJobStatus, BadgeColor> = {
  pending: 'warning',
  processing: 'secondary',
  completed: 'success',
  failed: 'error',
};

const PAGE_SIZE = 10;

const FIRST_SEASON = 1;
const LAST_SEASON = 13;
const SEASON_OPTIONS = Array.from(
  { length: LAST_SEASON - FIRST_SEASON + 1 },
  (_, i) => FIRST_SEASON + i,
);

const OPERATION_OPTIONS: JobOperation[] = [
  'paw_patrol_title_cards',
  'paw_patrol_file_suggestions',
  'paw_patrol_apply_file_renames',
];

const operationLabels: Record<JobOperation, string> = {
  paw_patrol_title_cards: 'Title Cards',
  paw_patrol_file_suggestions: 'File Suggestions',
  paw_patrol_apply_file_renames: 'Apply Renames',
};

// Only paw_patrol_apply_file_renames processes every pending file_renames
// row regardless of season — every other operation is season-scoped.
const operationNeedsSeason = (operation: JobOperation): boolean =>
  operation !== 'paw_patrol_apply_file_renames';

// file_suggestions (episode-matching) and title_cards (title-card detection)
// both call out to the AI in a way where swapping models job-to-job is
// useful — apply_file_renames doesn't take a model input at all.
const operationSupportsModelOverride = (operation: JobOperation): boolean =>
  operation === 'paw_patrol_file_suggestions' ||
  operation === 'paw_patrol_title_cards';

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
  aiStatus: AiStatus | null;
}

export function JobsClient({ jobs, aiStatus }: JobsClientProps) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [operation, setOperation] = useState<JobOperation>(
    OPERATION_OPTIONS[0],
  );
  const [season, setSeason] = useState(FIRST_SEASON);
  const [model, setModel] = useState('');
  const [operationMenuOpen, setOperationMenuOpen] = useState(false);
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const totalPages = jobs ? Math.max(1, Math.ceil(jobs.length / PAGE_SIZE)) : 1;
  const pageJobs = jobs?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function startJob() {
    setSubmitting(true);
    setSubmitError(null);

    try {
      await createJob(
        operation,
        operationNeedsSeason(operation) ? season : undefined,
        operationSupportsModelOverride(operation) ? model.trim() : undefined,
      );
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
        Video Jobs
      </Typography>

      <div className="flex flex-wrap items-center gap-3">
        <Badge color={aiStatus?.online ? 'success' : 'error'}>
          AI Server:{' '}
          {aiStatus === null
            ? 'Unknown'
            : aiStatus.online
              ? 'Online'
              : 'Offline'}
        </Badge>
        {aiStatus?.online &&
          (aiStatus.models.length > 0 ? (
            aiStatus.models.map((modelName) => (
              <OutlinedButton
                key={modelName}
                size="small"
                onClick={() => setModel(modelName)}
              >
                {modelName}
              </OutlinedButton>
            ))
          ) : (
            <Typography variant="body2" className="text-neutral-400">
              No models loaded
            </Typography>
          ))}
      </div>

      <div className="flex flex-col gap-2 self-start">
        <div className="flex items-center gap-4">
          <DropdownMenu
            open={operationMenuOpen}
            onOpenChange={setOperationMenuOpen}
          >
            <DropdownMenuTrigger asChild>
              <OutlinedButton size="small">
                Operation: {operationLabels[operation]}
              </OutlinedButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent label="Choose Operation">
              {OPERATION_OPTIONS.map((op) => (
                <DropdownMenuItem key={op} onSelect={() => setOperation(op)}>
                  {operationLabels[op]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {operationNeedsSeason(operation) && (
            <DropdownMenu
              open={seasonMenuOpen}
              onOpenChange={setSeasonMenuOpen}
            >
              <DropdownMenuTrigger asChild>
                <OutlinedButton size="small">Season: {season}</OutlinedButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent label="Choose Season">
                {SEASON_OPTIONS.map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => setSeason(s)}>
                    Season {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {operationSupportsModelOverride(operation) && (
            <Input
              placeholder="Model (default)"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              color="primary"
              className="w-56"
            />
          )}

          <Button
            size="small"
            disabled={submitting}
            onClick={() => void startJob()}
          >
            {submitting ? 'Starting…' : 'Start Job'}
          </Button>
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
            Failed to load jobs from video-api.
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
