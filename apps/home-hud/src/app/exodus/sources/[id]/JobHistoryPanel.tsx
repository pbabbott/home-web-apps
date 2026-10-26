import Link from 'next/link';
import {
  Badge,
  OutlinedButton,
  ScrollableTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
  Typography,
} from '@abbottland/fui-components';
import { JobActivity, JobPhaseBadge, JobProgress } from '../../lib/JobSummary';
import { LocalDateTime } from '../../lib/LocalDateTime';
import {
  JOB_STATUS_COLOR,
  formatDuration,
  jobDetailUrl,
  needsAttention,
} from '../../lib/job-display';
import type { DiscoveryJobWithCounts } from '../lib/homelab-api';

interface JobHistoryPanelProps {
  sourceId: string;
  jobs: DiscoveryJobWithCounts[];
  /** Show only active jobs a person should look at (see `needsAttention`). */
  attentionOnly: boolean;
}

export function JobHistoryPanel({
  sourceId,
  jobs,
  attentionOnly,
}: JobHistoryPanelProps) {
  const attentionCount = jobs.filter(needsAttention).length;
  const shown = attentionOnly ? jobs.filter(needsAttention) : jobs;
  const sourceUrl = `/exodus/sources/${sourceId}`;

  return (
    <div className="flex flex-col gap-4">
      <Typography variant="h5" component="h2">
        Job History
      </Typography>

      <div className="flex flex-wrap gap-2">
        <OutlinedButton
          component={Link}
          href={sourceUrl}
          size="small"
          color={attentionOnly ? 'secondary' : 'primary'}
        >
          All jobs
        </OutlinedButton>
        <OutlinedButton
          component={Link}
          href={`${sourceUrl}?attention=1`}
          size="small"
          color={attentionOnly ? 'primary' : 'secondary'}
        >
          Needs attention ({attentionCount})
        </OutlinedButton>
      </div>

      {shown.length === 0 ? (
        <Typography variant="body2" className="text-neutral-400">
          No active job needs attention.
        </Typography>
      ) : (
        <ScrollableTable className="mb-0">
          <Table size="small">
            <TableHead>
              <TableRow>
                <Th>ID</Th>
                <Th>Status</Th>
                <Th>Root</Th>
                <Th>Progress</Th>
                <Th>Last activity</Th>
                <Th>Created</Th>
                <Th>Finished</Th>
                <Th>Duration</Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {shown.map((job) => (
                <TableRow key={job.id}>
                  <Td>
                    <Link
                      href={jobDetailUrl(job.id)}
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
                  <Td>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color={JOB_STATUS_COLOR[job.status]}>
                        {job.status}
                      </Badge>
                      <JobPhaseBadge job={job} />
                    </div>
                  </Td>
                  <Td className="break-all">
                    <Link
                      href={jobDetailUrl(job.id)}
                      className="text-primary-400 hover:underline"
                    >
                      {job.rootPath}
                    </Link>
                  </Td>
                  <Td>
                    <JobProgress job={job} />
                  </Td>
                  <Td>
                    <JobActivity job={job} />
                  </Td>
                  <Td>
                    <LocalDateTime iso={job.createdAt} />
                  </Td>
                  <Td>
                    <LocalDateTime iso={job.finishedAt} />
                  </Td>
                  <Td>{formatDuration(job.createdAt, job.finishedAt)}</Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollableTable>
      )}
    </div>
  );
}
