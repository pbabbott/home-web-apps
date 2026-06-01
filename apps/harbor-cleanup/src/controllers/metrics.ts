import type { Request, Response } from 'express';
import { getStatusRecord } from '../data';
import { config } from '../config';

const toSeconds = (d?: Date): number | undefined =>
  d ? d.getTime() / 1000 : undefined;

const gauge = (
  name: string,
  help: string,
  value: number | undefined,
  labels?: Record<string, string>,
): string => {
  if (value === undefined) return '';
  const labelStr = labels
    ? '{' +
      Object.entries(labels)
        .map(
          ([k, v]) =>
            `${k}="${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`,
        )
        .join(',') +
      '}'
    : '';
  return `# HELP ${name} ${help}\n# TYPE ${name} gauge\n${name}${labelStr} ${value}\n`;
};

export const getMetrics = (_req: Request, res: Response) => {
  const s = getStatusRecord();

  const output = [
    gauge('harbor_cleanup_info', 'Static configuration info', 1, {
      cron_expression: config.cronExpression,
      timezone: config.TZ,
    }),
    gauge(
      'harbor_cleanup_last_run_start_timestamp_seconds',
      'Unix timestamp of last cleanup run start',
      toSeconds(s.lastRunStart),
    ),
    gauge(
      'harbor_cleanup_last_run_end_timestamp_seconds',
      'Unix timestamp of last cleanup run end',
      toSeconds(s.lastRunEnd),
    ),
    gauge(
      'harbor_cleanup_last_success_timestamp_seconds',
      'Unix timestamp of last successful cleanup run',
      toSeconds(s.lastSuccess),
    ),
    gauge(
      'harbor_cleanup_last_failure_timestamp_seconds',
      'Unix timestamp of last failed cleanup run',
      toSeconds(s.lastFailure),
    ),
    gauge(
      'harbor_cleanup_last_run_duration_ms',
      'Duration of last cleanup run in milliseconds',
      s.lastResult?.durationMs,
    ),
    gauge(
      'harbor_cleanup_last_run_total_deleted',
      'Total tags deleted in last cleanup run',
      s.lastResult?.totalDeleted,
    ),
    gauge(
      'harbor_cleanup_last_run_total_errors',
      'Total errors in last cleanup run',
      s.lastResult?.totalErrors,
    ),
  ]
    .filter(Boolean)
    .join('\n');

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.status(200).send(output);
};
