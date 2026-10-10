'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Badge,
  type BadgeColor,
  OutlinedButton,
  Panel,
  ScrollableTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Th,
  Td,
  Typography,
} from '@abbottland/fui-components';
import { Icon } from '@abbottland/fui-icons';
import type {
  VideoJob,
  VideoJobStatus,
  VideoJobStep,
  VideoJobStepStatus,
} from '../lib/video-api';

const jobStatusColor: Record<VideoJobStatus, BadgeColor> = {
  pending: 'warning',
  processing: 'secondary',
  completed: 'success',
  failed: 'error',
};

const stepStatusColor: Record<VideoJobStepStatus, BadgeColor> = {
  in_progress: 'secondary',
  completed: 'success',
  failed: 'error',
};

const isTerminal = (status: VideoJobStatus): boolean =>
  status === 'completed' || status === 'failed';

// Fixed locale/timeZone so server and client render identical text — a
// locale-dependent format (e.g. toLocaleString()) mismatches across the
// SSR/hydration boundary whenever the server and browser timezones differ.
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

function formatDate(iso: string | null): string {
  return iso ? dateFormatter.format(new Date(iso)) : '—';
}

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;

/** Elapsed time from startedAt to completedAt (or now, if still running), as m:ss.mmm. */
function formatDuration(startedAt: string, completedAt: string | null): string {
  const elapsedMs = Math.max(
    0,
    (completedAt ? new Date(completedAt) : new Date()).getTime() -
      new Date(startedAt).getTime(),
  );
  const totalSeconds = Math.floor(elapsedMs / MS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  const millis = elapsedMs % MS_PER_SECOND;

  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Typography variant="small" className="text-neutral-400">
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {value}
      </Typography>
    </div>
  );
}

interface JobDetailClientProps {
  job: VideoJob;
  initialSteps: VideoJobStep[];
}

export function JobDetailClient({
  job: initialJob,
  initialSteps,
}: JobDetailClientProps) {
  const [job, setJob] = useState(initialJob);
  const [steps, setSteps] = useState(initialSteps);

  useEffect(() => {
    // Nothing left to watch — a terminal job never changes again.
    if (isTerminal(initialJob.status)) return;

    const source = new EventSource(`/jobs/${initialJob.id}/steps`);

    source.onmessage = (event) => {
      const payload: { job: VideoJob; steps: VideoJobStep[] } = JSON.parse(
        event.data,
      );

      setJob(payload.job);
      setSteps(payload.steps);

      // Server ends its response on a terminal status, but that alone
      // doesn't stop a browser EventSource from auto-reconnecting — close
      // it explicitly once we see the job is actually done.
      if (isTerminal(payload.job.status)) {
        source.close();
      }
    };

    return () => source.close();
  }, [initialJob.id, initialJob.status]);

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-neutral-800 px-8 py-2">
      <div className="flex flex-col gap-4">
        <Link href="/jobs" className="self-start">
          <OutlinedButton size="small" color="secondary">
            <span className="flex items-center gap-1">
              <Icon
                name="radix-chevron-left"
                size={14}
                className="text-secondary-500"
              />
              Back to Jobs
            </span>
          </OutlinedButton>
        </Link>

        <div className="flex items-center gap-4">
          <Typography variant="h1" component="h1">
            Job {job.id.slice(0, 8)}
          </Typography>
          <Badge color={jobStatusColor[job.status]}>{job.status}</Badge>
        </div>
      </div>

      <Panel color="default" className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
          <Field label="Id" value={job.id} />
          <Field label="Operation" value={job.operation} />
          <Field label="Worker" value={job.workerId ?? '—'} />
          <Field label="Created" value={formatDate(job.createdAt)} />
          <Field label="Started" value={formatDate(job.startedAt)} />
          <Field label="Completed" value={formatDate(job.completedAt)} />
          <Field label="Last Heartbeat" value={formatDate(job.heartbeatAt)} />
        </div>

        <Field
          label="Parameters"
          value={
            <pre className="overflow-x-auto rounded bg-neutral-900 p-3 text-sm">
              {JSON.stringify(job.parameters, null, 2)}
            </pre>
          }
        />

        {job.message && <Field label="Message" value={job.message} />}

        {job.error && (
          <Field
            label="Error"
            value={<span className="text-error-400">{job.error}</span>}
          />
        )}
      </Panel>

      <div className="flex flex-col gap-2">
        <Typography variant="h5" component="h2">
          Steps
        </Typography>

        {steps.length === 0 ? (
          <Typography variant="body2" className="text-neutral-400">
            No steps recorded yet.
          </Typography>
        ) : (
          <ScrollableTable className="mb-0">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <Th>Step</Th>
                  <Th>Status</Th>
                  <Th>Message</Th>
                  <Th>Duration</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {steps.map((step) => (
                  <TableRow key={step.id}>
                    <Td>{step.stepName}</Td>
                    <Td>
                      <Badge color={stepStatusColor[step.status]}>
                        {step.status}
                      </Badge>
                    </Td>
                    <Td>{step.message ?? '—'}</Td>
                    <Td>{formatDuration(step.startedAt, step.completedAt)}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTable>
        )}
      </div>
    </main>
  );
}
