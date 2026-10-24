'use client';

import { useState } from 'react';
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
import { LocalDateTime } from '../../lib/LocalDateTime';
import { retryQueueItem } from '../lib/actions';
import type { QueueItem } from '../lib/homelab-api';

export function FailedItemsPanel({
  items,
  activeJobIds,
  onRetried,
}: {
  items: QueueItem[];
  /** Ids of the source's pending/running jobs; only their failures can be retried. */
  activeJobIds: ReadonlySet<string>;
  onRetried: () => void;
}) {
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function retry(id: string) {
    setRetryingId(id);
    setError(null);
    const result = await retryQueueItem(id);
    setRetryingId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onRetried();
  }

  return (
    <Panel color="default" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Typography variant="h5" component="h2">
          Failed Directories
        </Typography>
        <Badge color="error">{items.length}</Badge>
      </div>

      <ScrollableTable className="mb-0">
        <Table size="small">
          <TableHead>
            <TableRow>
              <Th>Path</Th>
              <Th>Attempts</Th>
              <Th>Last error</Th>
              <Th>Failed</Th>
              <Th>&nbsp;</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <Td className="break-all">{item.path}</Td>
                <Td>
                  {item.attemptCount} / {item.maxAttempts}
                </Td>
                <Td>{item.lastError ?? '—'}</Td>
                <Td>
                  <LocalDateTime iso={item.updatedAt} />
                </Td>
                <Td>
                  {activeJobIds.has(item.jobId) ? (
                    <OutlinedButton
                      size="small"
                      disabled={retryingId !== null}
                      onClick={() => void retry(item.id)}
                    >
                      {retryingId === item.id ? 'Retrying…' : 'Retry'}
                    </OutlinedButton>
                  ) : (
                    <Typography variant="body2">Job finished</Typography>
                  )}
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollableTable>

      {items.some((item) => !activeJobIds.has(item.jobId)) && (
        <Typography variant="body2">
          Failures from a finished job can’t be retried. Start a new job to
          explore those directories again.
        </Typography>
      )}

      {error && (
        <Typography variant="body2" className="text-error-400">
          {error}
        </Typography>
      )}
    </Panel>
  );
}
