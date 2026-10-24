import Link from 'next/link';
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
import { JobActivity, JobPhaseBadge, JobProgress } from '../../lib/JobSummary';
import { LocalDateTime } from '../../lib/LocalDateTime';
import { JOB_STATUS_COLOR } from '../../lib/job-display';
import type { DiscoveryJobWithCounts } from '../lib/homelab-api';

export function JobHistoryPanel({ jobs }: { jobs: DiscoveryJobWithCounts[] }) {
  return (
    <Panel color="default" className="flex flex-col gap-4">
      <Typography variant="h5" component="h2">
        Job History
      </Typography>

      <ScrollableTable className="mb-0">
        <Table size="small">
          <TableHead>
            <TableRow>
              <Th>Status</Th>
              <Th>Root</Th>
              <Th>Progress</Th>
              <Th>Last activity</Th>
              <Th>Created</Th>
              <Th>Finished</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
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
                    href={`/exodus/jobs/${job.id}`}
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollableTable>
    </Panel>
  );
}
