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
import { LocalDateTime } from '../../lib/LocalDateTime';
import { JOB_STATUS_COLOR } from '../../lib/job-display';
import type { DiscoveryJob } from '../lib/homelab-api';

export function JobHistoryPanel({ jobs }: { jobs: DiscoveryJob[] }) {
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
              <Th>Created</Th>
              <Th>Finished</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <Td>
                  <Badge color={JOB_STATUS_COLOR[job.status]}>
                    {job.status}
                  </Badge>
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
