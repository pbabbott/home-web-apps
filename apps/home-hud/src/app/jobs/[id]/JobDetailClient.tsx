'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Badge,
  type BadgeColor,
  OutlinedButton,
  Panel,
  Typography,
} from '@abbottland/fui-components';
import { Icon } from '@abbottland/fui-icons';
import type { VideoJob, VideoJobStatus } from '../lib/video-api';

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

function formatDate(iso: string | null): string {
  return iso ? dateFormatter.format(new Date(iso)) : '—';
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
}

export function JobDetailClient({ job }: JobDetailClientProps) {
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

        {job.outputPaths && job.outputPaths.length > 0 && (
          <Field
            label="Output Paths"
            value={
              <ul className="flex flex-col gap-1">
                {job.outputPaths.map((path) => (
                  <li key={path}>{path}</li>
                ))}
              </ul>
            }
          />
        )}

        {job.message && <Field label="Message" value={job.message} />}

        {job.error && (
          <Field
            label="Error"
            value={<span className="text-error-400">{job.error}</span>}
          />
        )}
      </Panel>
    </main>
  );
}
