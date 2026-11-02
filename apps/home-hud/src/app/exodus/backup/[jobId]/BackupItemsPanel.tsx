import Link from 'next/link';
import {
  Badge,
  OutlinedButton,
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
import {
  BACKUP_ITEM_STATUS_COLOR,
  backupJobUrl,
  canRetryBackupItem,
} from '../../lib/backup-display';
import type {
  BackupJob,
  BackupJobItem,
  BackupJobItemStatus,
} from '../../sources/lib/homelab-api';
import { COUNT_TILES } from './BackupProgressPanel';

const FILTER_STATUSES: (BackupJobItemStatus | undefined)[] = [
  undefined,
  ...COUNT_TILES.map((tile) => tile.status),
];

interface Props {
  job: BackupJob;
  /** Null if the items could not be loaded. */
  items: BackupJobItem[] | null;
  hasMoreItems: boolean;
  statusFilter: BackupJobItemStatus | undefined;
  busy: boolean;
  onShowFiles: (item: BackupJobItem) => void;
  onRetry: (item: BackupJobItem) => void;
}

export function BackupItemsPanel({
  job,
  items,
  hasMoreItems,
  statusFilter,
  busy,
  onShowFiles,
  onRetry,
}: Props) {
  return (
    <Panel color="default" className="flex flex-col gap-4">
      <Typography variant="h5" component="h2">
        Items
      </Typography>

      <div className="flex flex-wrap gap-2">
        {FILTER_STATUSES.map((status) => (
          <OutlinedButton
            key={status ?? 'all'}
            component={Link}
            href={backupJobUrl(job.id, status)}
            size="small"
            color={status === statusFilter ? 'accent-falcon' : undefined}
          >
            {status ?? 'all'}
          </OutlinedButton>
        ))}
      </div>

      {items === null ? (
        <Typography variant="body2" className="text-error-400">
          Failed to load the items from homelab-api.
        </Typography>
      ) : items.length === 0 ? (
        <Typography variant="body2" className="text-neutral-400">
          No items{statusFilter ? ` with status ${statusFilter}` : ''}.
        </Typography>
      ) : (
        <ScrollableTable className="mb-0">
          <Table size="small">
            <TableHead>
              <TableRow>
                <Th>Path</Th>
                <Th>Status</Th>
                <Th>Attempts</Th>
                <Th>Last error</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <Td className="break-all">
                    {item.rootPath}
                    {item.kind === 'directory' ? ' (folder)' : ''}
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1">
                      <Badge color={BACKUP_ITEM_STATUS_COLOR[item.status]}>
                        {item.status}
                      </Badge>
                      {item.statusReason && (
                        <Typography
                          variant="caption"
                          className="text-neutral-400"
                        >
                          {item.statusReason.replaceAll('_', ' ')}
                        </Typography>
                      )}
                    </div>
                  </Td>
                  <Td>
                    {item.attemptCount} / {item.maxAttempts}
                  </Td>
                  <Td className="break-all">{item.lastError ?? '—'}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      {(item.status === 'verified' ||
                        item.status === 'in_progress' ||
                        item.status === 'failed' ||
                        item.status === 'blocked' ||
                        item.status === 'queued') && (
                        <OutlinedButton
                          size="small"
                          onClick={() => onShowFiles(item)}
                        >
                          Files
                        </OutlinedButton>
                      )}
                      {canRetryBackupItem(job, item) && (
                        <OutlinedButton
                          size="small"
                          disabled={busy}
                          onClick={() => onRetry(item)}
                        >
                          Retry
                        </OutlinedButton>
                      )}
                    </div>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollableTable>
      )}

      {hasMoreItems && (
        <Typography variant="body2" className="text-warning-400">
          Showing the first {items?.length} items by path. Filter by status to
          narrow it down.
        </Typography>
      )}
    </Panel>
  );
}
