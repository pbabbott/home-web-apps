'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
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
import { listSkippedGroupMatches } from '../sources/lib/actions';
import type { SkippedGroupMatches } from '../sources/lib/homelab-api';
import { PromoteSkippedModal } from './PromoteSkippedModal';
import { formatSize, inventoryItemUrl } from './inventory-display';
import { PreviewButton } from './PreviewButton';

type Loaded =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; matches: SkippedGroupMatches };

interface PatternMatchesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId: string;
  queueItem: { id: string; path: string };
  pattern: string;
  /** What the agent said the pattern covers, to compare with what is really there. */
  expectedCount?: number;
  reason: string;
  /** Lowercased paths already in the inventory. */
  inventoried: ReadonlySet<string>;
  onPromoted: (path: string) => void;
}

/** Lists, live from the source, the entries a skipped pattern excluded so the reviewer can see what they are acknowledging. */
export function PatternMatchesModal({
  open,
  onOpenChange,
  sourceId,
  queueItem,
  pattern,
  expectedCount,
  reason,
  inventoried,
  onPromoted,
}: PatternMatchesModalProps) {
  const queueItemId = queueItem.id;
  const key = `${queueItemId}:${pattern}`;
  const [promoting, setPromoting] = useState<string | null>(null);
  const [result, setResult] = useState<{ key: string; value: Loaded } | null>(
    null,
  );
  // A result for a previous pattern reads as loading until the new fetch lands.
  const loaded: Loaded =
    result?.key === key ? result.value : { status: 'loading' };

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    void listSkippedGroupMatches(queueItemId, pattern).then((res) => {
      if (cancelled) return;
      setResult({
        key,
        value: res.ok
          ? { status: 'loaded', matches: res.data }
          : { status: 'error', message: res.error },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [open, queueItemId, pattern, key]);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent color="secondary" className="max-w-4xl">
        <ModalTitle className="break-all">{pattern}</ModalTitle>
        <ModalDescription className="break-all">
          {loaded.status === 'loaded' ? loaded.matches.path : reason}
        </ModalDescription>

        <div className="mt-4 flex max-h-[70vh] min-h-40 flex-col gap-2 overflow-auto">
          {loaded.status === 'loading' && (
            <Typography variant="body2" className="text-neutral-400">
              Reading the directory…
            </Typography>
          )}
          {loaded.status === 'error' && (
            <Typography variant="body2" className="text-error-400">
              {loaded.message}
            </Typography>
          )}
          {loaded.status === 'loaded' && (
            <>
              <Typography variant="body2" className="text-neutral-400">
                {loaded.matches.total} found
                {expectedCount !== undefined &&
                  expectedCount !== loaded.matches.total &&
                  ` (the agent reported ${expectedCount})`}
                {loaded.matches.truncated &&
                  ` · showing the first ${loaded.matches.entries.length}`}
                {' · '}
                {reason}
              </Typography>
              {loaded.matches.entries.length > 0 && (
                <ScrollableTable className="mb-0">
                  <Table size="small" color="secondary">
                    <TableHead>
                      <TableRow>
                        <Th color="secondary">Name</Th>
                        <Th color="secondary">Size</Th>
                        <Th color="secondary">Modified</Th>
                        <Th color="secondary">Inventory</Th>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loaded.matches.entries.map((entry) => (
                        <TableRow key={entry.name}>
                          <Td color="secondary" className="break-all">
                            <div className="flex items-center gap-2">
                              {!entry.isDirectory && (
                                <PreviewButton
                                  sourceId={sourceId}
                                  path={entry.path}
                                />
                              )}
                              <span>
                                {entry.name}
                                {entry.isDirectory && '\\'}
                              </span>
                            </div>
                          </Td>
                          <Td
                            color="secondary"
                            className="whitespace-nowrap text-neutral-400"
                          >
                            {entry.isDirectory ? '—' : formatSize(entry.size)}
                          </Td>
                          <Td
                            color="secondary"
                            className="whitespace-nowrap text-neutral-400"
                          >
                            {entry.modifiedAt?.replace('T', ' ') ?? '—'}
                          </Td>
                          <Td color="secondary">
                            {inventoried.has(entry.path.toLowerCase()) ? (
                              <Link
                                href={inventoryItemUrl(sourceId, entry.path)}
                                className="text-neutral-400 underline"
                              >
                                In inventory
                              </Link>
                            ) : (
                              <OutlinedButton
                                size="small"
                                color="secondary"
                                onClick={() => setPromoting(entry.path)}
                              >
                                Promote
                              </OutlinedButton>
                            )}
                          </Td>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollableTable>
              )}
            </>
          )}
        </div>
      </ModalContent>

      {promoting && (
        <PromoteSkippedModal
          key={promoting}
          open
          onOpenChange={(next) => {
            if (!next) setPromoting(null);
          }}
          queueItem={queueItem}
          path={promoting}
          skipReason={`Matched skipped pattern ${pattern}: ${reason}`}
          onPromoted={onPromoted}
        />
      )}
    </Modal>
  );
}
