'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
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
import { BACKUP_ENTRY_STATUS_COLOR } from '../lib/backup-display';
import { formatSize } from '../lib/inventory-display';
import { LocalDateTime } from '../lib/LocalDateTime';
import { listBackupEntries } from '../sources/lib/actions';
import type {
  BackupEntry,
  BackupEntryStatus,
  BackupJobItem,
} from '../sources/lib/homelab-api';

const FILTERS: (BackupEntryStatus | undefined)[] = [
  undefined,
  'pending',
  'verified',
  'failed',
  'not_followed',
];

/** Per-file results of one job item, loaded a page at a time when opened. */
export function BackupEntriesModal({
  item,
  onClose,
}: {
  item: BackupJobItem;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<BackupEntryStatus | undefined>(
    item.status === 'failed' || item.status === 'blocked'
      ? 'failed'
      : undefined,
  );
  const [entries, setEntries] = useState<BackupEntry[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped to load again from the start with the current filter.
  const [page, setPage] = useState<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    void listBackupEntries(item.id, { status, after: page }).then((result) => {
      if (cancelled) return;

      setLoading(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setError(null);
      setNext(result.data.next);
      setEntries((prev) =>
        page === undefined
          ? result.data.entries
          : [...prev, ...result.data.entries],
      );
    });

    return () => {
      cancelled = true;
    };
  }, [item.id, status, page]);

  function pick(value: BackupEntryStatus | undefined) {
    setLoading(true);
    setEntries([]);
    setNext(null);
    setPage(undefined);
    setStatus(value);
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()}>
      <ModalContent color="secondary" className="max-w-5xl">
        <ModalTitle>Files in this item</ModalTitle>
        <ModalDescription className="break-all">
          {item.rootPath}
        </ModalDescription>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((value) => (
            <OutlinedButton
              key={value ?? 'all'}
              type="button"
              size="small"
              color={value === status ? 'accent-falcon' : undefined}
              onClick={() => pick(value)}
            >
              {value ?? 'all'}
            </OutlinedButton>
          ))}
        </div>

        {error && (
          <Typography variant="body2" className="mt-4 text-error-400">
            {error}
          </Typography>
        )}

        {!error && !loading && entries.length === 0 && (
          <Typography variant="body2" className="mt-4 text-neutral-400">
            {item.enumerationComplete
              ? 'No files match.'
              : 'Nothing listed yet.'}
          </Typography>
        )}

        {entries.length > 0 && (
          <ScrollableTable className="mt-4 mb-0 max-h-96">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <Th>Path</Th>
                  <Th>Status</Th>
                  <Th>Size</Th>
                  <Th>Source modified</Th>
                  <Th>On destination</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <Td className="break-all">
                      {entry.relPath || '(item root)'}
                      {entry.entryType === 'directory' ? ' (folder)' : ''}
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <Badge color={BACKUP_ENTRY_STATUS_COLOR[entry.status]}>
                          {entry.status}
                        </Badge>
                        {(entry.issueKind || entry.message) && (
                          <Typography
                            variant="caption"
                            className="break-all text-neutral-400"
                          >
                            {[entry.issueKind, entry.message]
                              .filter(Boolean)
                              .join(': ')}
                          </Typography>
                        )}
                      </div>
                    </Td>
                    <Td>
                      {entry.sizeBytes === null
                        ? '—'
                        : formatSize(entry.sizeBytes)}
                    </Td>
                    <Td>
                      <LocalDateTime iso={entry.srcModifiedAt} />
                    </Td>
                    <Td className="break-all">{entry.destRelPath ?? '—'}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTable>
        )}

        <div className="mt-4 flex justify-end gap-3">
          {next !== null && (
            <OutlinedButton
              type="button"
              size="small"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                setPage(next);
              }}
            >
              Load more
            </OutlinedButton>
          )}
          <OutlinedButton type="button" size="small" onClick={onClose}>
            Close
          </OutlinedButton>
        </div>
      </ModalContent>
    </Modal>
  );
}
