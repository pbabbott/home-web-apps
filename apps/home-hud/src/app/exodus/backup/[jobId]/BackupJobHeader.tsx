import Link from 'next/link';
import { Badge, OutlinedButton, Typography } from '@abbottland/fui-components';
import {
  BACKUP_JOB_STATUS_COLOR,
  backupJobScopeLabel,
  backupOverviewUrl,
} from '../../lib/backup-display';
import { formatDuration } from '../../lib/job-display';
import { LocalDateTime } from '../../lib/LocalDateTime';
import type { BackupJob } from '../../sources/lib/homelab-api';

interface Props {
  job: BackupJob;
  sourceName: string | null;
  destinationName: string | null;
}

export function BackupJobHeader({ job, sourceName, destinationName }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <OutlinedButton
        component={Link}
        href={backupOverviewUrl(job.sourceId, job.destinationId)}
        color="secondary"
        size="small"
        className="self-start"
      >
        ← Backup
      </OutlinedButton>
      <div className="flex flex-wrap items-center gap-3">
        <Typography variant="h1" component="h1">
          Backup job {job.id.slice(0, 8)}
        </Typography>
        <Badge color={BACKUP_JOB_STATUS_COLOR[job.status]}>{job.status}</Badge>
      </div>
      <Typography variant="body2" className="break-all text-neutral-400">
        {sourceName ?? 'Unknown source'} → {destinationName ?? 'destination'} /{' '}
        {job.sourceDirName}
        {' · '}
        {backupJobScopeLabel(job.scope)}
        {' · created '}
        <LocalDateTime iso={job.createdAt} />
        {job.startedAt && (
          <>
            {' · started '}
            <LocalDateTime iso={job.startedAt} />
          </>
        )}
        {job.finishedAt && (
          <>
            {' · finished '}
            <LocalDateTime iso={job.finishedAt} />
            {` (${formatDuration(job.startedAt ?? job.createdAt, job.finishedAt)})`}
          </>
        )}
      </Typography>
    </div>
  );
}
