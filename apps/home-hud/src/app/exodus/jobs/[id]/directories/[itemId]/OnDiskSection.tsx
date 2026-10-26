'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  type BadgeColor,
} from '@abbottland/fui-components';
import {
  DECISION_COLOR,
  DECISION_LABELS,
  formatSize,
} from '../../../../lib/inventory-display';
import { QUEUE_STATUS_COLOR } from '../../../../lib/job-display';
import { LocalDateTime } from '../../../../lib/LocalDateTime';
import { PreviewButton } from '../../../../lib/PreviewButton';
import { listDirectoryOnDisk } from '../../../../sources/lib/actions';
import type {
  DirectoryListing,
  DiskCoverage,
} from '../../../../sources/lib/homelab-api';

function describeCoverage(coverage: DiskCoverage): {
  label: string;
  color: BadgeColor;
} {
  switch (coverage.kind) {
    case 'inventory':
      return {
        label: `Inventory · ${DECISION_LABELS[coverage.decision]}`,
        color: DECISION_COLOR[coverage.decision],
      };
    case 'inventory_parent':
      return { label: 'Covered by inventory above', color: 'secondary' };
    case 'skipped':
      return {
        label: `Skipped${coverage.via === 'pattern' ? ` (${coverage.pattern})` : ''} · ${coverage.acknowledged ? 'acknowledged' : 'to review'}`,
        color: coverage.acknowledged ? 'success' : 'warning',
      };
    case 'queued':
      return {
        label: `Own queue item · ${coverage.status}`,
        color: QUEUE_STATUS_COLOR[coverage.status],
      };
    case 'excluded':
      return { label: 'Excluded by rule', color: 'secondary' };
    case 'inventory_inside':
      return {
        label: `${coverage.count} inventory ${coverage.count === 1 ? 'item' : 'items'} inside`,
        color: 'secondary',
      };
    case 'uncovered':
      return { label: 'Not covered', color: 'error' };
  }
}

interface OnDiskSectionProps {
  sourceId: string;
  queueItemId: string;
  /** Changes when a skip, inventory item or approval changes, so a loaded listing is re-read. */
  coverageSignature: string;
  /** Opens the promote form for an entry nothing accounts for. */
  onPromote: (path: string) => void;
}

/** What is actually in the directory on the source, to find what the agent left unaccounted for. */
export function OnDiskSection({
  sourceId,
  queueItemId,
  coverageSignature,
  onPromote,
}: OnDiskSectionProps) {
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlyUncovered, setOnlyUncovered] = useState(false);
  // The latest request wins, so a slow earlier scan cannot overwrite a newer one.
  const latest = useRef(0);
  // The coverage state the current listing was read under; null before the first scan.
  const scannedWith = useRef<string | null>(null);

  const scan = useCallback(async () => {
    const request = ++latest.current;
    scannedWith.current = coverageSignature;
    setLoading(true);
    setError(null);
    const res = await listDirectoryOnDisk(queueItemId);

    if (request !== latest.current) return;

    setLoading(false);

    if (res.ok) setListing(res.data);
    else setError(res.error);
  }, [queueItemId, coverageSignature]);

  const loaded = listing !== null;

  // After a first scan, read again when skips or inventory change, so coverage stays current.
  useEffect(() => {
    if (
      scannedWith.current === null ||
      scannedWith.current === coverageSignature
    )
      return;

    const timer = setTimeout(() => void scan(), 0);

    return () => clearTimeout(timer);
  }, [coverageSignature, scan]);

  const rows = [...(listing?.entries ?? [])]
    .filter((e) => !onlyUncovered || e.coverage.kind === 'uncovered')
    .sort(
      (a, b) =>
        Number(b.coverage.kind === 'uncovered') -
          Number(a.coverage.kind === 'uncovered') ||
        Number(b.isDirectory) - Number(a.isDirectory) ||
        a.name.localeCompare(b.name),
    );

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography variant="h5" component="h2">
          On disk
        </Typography>
        <div className="flex flex-wrap items-center gap-2">
          {loaded && (
            <OutlinedButton
              size="small"
              color={onlyUncovered ? 'primary' : 'secondary'}
              aria-pressed={onlyUncovered}
              onClick={() => setOnlyUncovered((current) => !current)}
            >
              Only not covered
            </OutlinedButton>
          )}
          <OutlinedButton
            size="small"
            color="primary"
            disabled={loading}
            onClick={() => void scan()}
          >
            {loading ? 'Listing…' : loaded ? 'Rescan' : 'List on disk'}
          </OutlinedButton>
        </div>
      </div>

      {error && (
        <Typography variant="body2" className="text-error-400">
          {error}
        </Typography>
      )}

      {!loaded && !error && (
        <Typography variant="body2" className="text-neutral-400">
          Reads this directory from the source and shows which entries no
          inventory item, skip or queue item accounts for.
        </Typography>
      )}

      {listing && (
        <>
          <Typography
            variant="body2"
            className={
              listing.uncovered > 0 ? 'text-warning-400' : 'text-success-400'
            }
          >
            {listing.total} {listing.total === 1 ? 'entry' : 'entries'} ·{' '}
            {listing.uncovered > 0
              ? `${listing.uncovered} not covered`
              : 'everything accounted for'}
          </Typography>
          {listing.truncated && (
            <Typography variant="body2" className="text-warning-400">
              Showing the first {listing.entries.length} of {listing.total}{' '}
              entries.
            </Typography>
          )}
          {rows.length === 0 ? (
            <Typography variant="body2" className="text-neutral-400">
              {listing.total === 0 ? 'The directory is empty.' : 'None.'}
            </Typography>
          ) : (
            <ScrollableTable className="mb-0">
              <Table size="small" color="secondary">
                <TableHead>
                  <TableRow>
                    <Th color="secondary">Coverage</Th>
                    <Th color="secondary">Name</Th>
                    <Th color="secondary">Size</Th>
                    <Th color="secondary">Modified</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((entry) => {
                    const coverage = describeCoverage(entry.coverage);

                    return (
                      <TableRow key={entry.path}>
                        <Td color="secondary">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge color={coverage.color}>
                              {coverage.label}
                            </Badge>
                            {entry.coverage.kind === 'uncovered' && (
                              <OutlinedButton
                                size="small"
                                color="secondary"
                                onClick={() => onPromote(entry.path)}
                              >
                                Promote
                              </OutlinedButton>
                            )}
                          </div>
                        </Td>
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
                              {entry.isDirectory ? '\\' : ''}
                            </span>
                          </div>
                        </Td>
                        <Td color="secondary" className="text-neutral-400">
                          {entry.isDirectory ? '—' : formatSize(entry.size)}
                        </Td>
                        <Td color="secondary" className="text-neutral-400">
                          <LocalDateTime iso={entry.modifiedAt} />
                        </Td>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollableTable>
          )}
        </>
      )}
    </section>
  );
}
