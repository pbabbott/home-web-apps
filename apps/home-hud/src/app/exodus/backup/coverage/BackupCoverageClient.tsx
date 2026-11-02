'use client';

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
  TransparentPanel,
  Typography,
} from '@abbottland/fui-components';
import {
  COVERAGE_BUCKETS,
  COVERAGE_BUCKET_COLOR,
  COVERAGE_BUCKET_LABEL,
  backupCoverageUrl,
  backupJobUrl,
  backupOverviewUrl,
  coverageDownloadUrl,
  isBlockingBucket,
} from '../../lib/backup-display';
import { LocalDateTime } from '../../lib/LocalDateTime';
import type {
  BackupCoverage,
  BackupCoverageBucket,
} from '../../sources/lib/homelab-api';
import { BackupPicker } from '../BackupPicker';

interface Props {
  sources: { id: string; name: string }[];
  destinations: { id: string; name: string }[];
  sourceId: string | null;
  destinationId: string | null;
  bucket: BackupCoverageBucket | undefined;
  /** Null if the report could not be loaded. */
  coverage: BackupCoverage | null;
}

export function BackupCoverageClient({
  sources,
  destinations,
  sourceId,
  destinationId,
  bucket,
  coverage,
}: Props) {
  const review = coverage?.discoveryReview;

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
      <div className="flex flex-col gap-2">
        <OutlinedButton
          component={Link}
          href={backupOverviewUrl(sourceId ?? undefined, destinationId ?? undefined)}
          color="secondary"
          size="small"
          className="self-start"
        >
          ← Backup
        </OutlinedButton>
        <Typography variant="h1" component="h1">
          Backup coverage
        </Typography>
        <Typography variant="body2" className="text-neutral-400">
          Which inventory items are verified on the destination, and which are
          not.
        </Typography>
      </div>

      {!sourceId || !destinationId ? (
        <Typography variant="body2" className="text-neutral-400">
          A source and a backup destination are needed first.
        </Typography>
      ) : (
        <>
          <BackupPicker
            sources={sources}
            destinations={destinations}
            sourceId={sourceId}
            destinationId={destinationId}
            urlFor={(s, d) => backupCoverageUrl(s, d)}
          />

          {!coverage ? (
            <Typography variant="body2" className="text-error-400">
              Failed to load the coverage report from homelab-api.
            </Typography>
          ) : (
            <>
              <Panel color="default" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Typography variant="h5" component="h2">
                      {coverage.allAccounted
                        ? 'All accounted for'
                        : 'Not everything is accounted for'}
                    </Typography>
                    <Badge color={coverage.allAccounted ? 'success' : 'warning'}>
                      {coverage.allAccounted ? 'yes' : 'no'}
                    </Badge>
                  </div>
                  <OutlinedButton
                    component="a"
                    href={coverageDownloadUrl(sourceId, destinationId)}
                    color="accent-falcon"
                    size="small"
                  >
                    Download JSON
                  </OutlinedButton>
                </div>
                <Typography variant="body2">{coverage.scope}</Typography>
                <Typography variant="caption" className="text-neutral-400">
                  {coverage.total} inventory items · generated{' '}
                  <LocalDateTime iso={coverage.generatedAt} seconds />
                </Typography>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {COVERAGE_BUCKETS.map((key) => (
                    <Link
                      key={key}
                      href={backupCoverageUrl(
                        sourceId,
                        destinationId,
                        key === bucket ? undefined : key,
                      )}
                    >
                      <TransparentPanel
                        color={
                          coverage.counts[key] > 0 && isBlockingBucket(key)
                            ? 'warning'
                            : key === bucket
                              ? 'accent-falcon'
                              : undefined
                        }
                        className="flex flex-col gap-0.5"
                      >
                        <Typography variant="caption">
                          {COVERAGE_BUCKET_LABEL[key]}
                          {isBlockingBucket(key) ? ' *' : ''}
                        </Typography>
                        <Typography variant="h5" component="span">
                          {coverage.counts[key]}
                        </Typography>
                      </TransparentPanel>
                    </Link>
                  ))}
                </div>
                <Typography variant="caption" className="text-neutral-400">
                  * Items in these buckets stop “all accounted for”.
                </Typography>
              </Panel>

              <Panel color="default" className="flex flex-col gap-4">
                <Typography variant="h5" component="h2">
                  Items{bucket ? `: ${COVERAGE_BUCKET_LABEL[bucket]}` : ''}
                </Typography>
                {coverage.omittedRejected > 0 && (
                  <Typography variant="body2" className="text-neutral-400">
                    {coverage.omittedRejected} rejected items are counted but
                    not listed; choose “Rejected” above to list them.
                  </Typography>
                )}
                {coverage.items.length === 0 ? (
                  <Typography variant="body2" className="text-neutral-400">
                    No items.
                  </Typography>
                ) : (
                  <ScrollableTable className="mb-0">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <Th>Path</Th>
                          <Th>Bucket</Th>
                          <Th>Latest attempt</Th>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {coverage.items.map((item) => (
                          <TableRow key={item.inventoryItemId}>
                            <Td className="break-all">
                              {item.rootPath}
                              {item.kind === 'directory' ? ' (folder)' : ''}
                            </Td>
                            <Td>
                              <Badge color={COVERAGE_BUCKET_COLOR[item.bucket]}>
                                {COVERAGE_BUCKET_LABEL[item.bucket]}
                              </Badge>
                            </Td>
                            <Td>
                              {item.latestAttempt ? (
                                <div className="flex flex-col gap-1">
                                  <Link
                                    href={backupJobUrl(item.latestAttempt.jobId)}
                                    className="text-primary-400 hover:underline"
                                  >
                                    {item.latestAttempt.itemStatus} · job{' '}
                                    {item.latestAttempt.jobId.slice(0, 8)}
                                  </Link>
                                  {item.latestAttempt.lastError && (
                                    <Typography
                                      variant="caption"
                                      className="break-all text-neutral-400"
                                    >
                                      {item.latestAttempt.lastError}
                                    </Typography>
                                  )}
                                </div>
                              ) : (
                                '—'
                              )}
                            </Td>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTable>
                )}
              </Panel>

              <Panel color="default" className="flex flex-col gap-3">
                <Typography variant="h5" component="h2">
                  Notes
                </Typography>
                <Typography variant="body2">
                  {coverage.notes.keptBothFiles} files were kept next to a
                  different file already on the destination;{' '}
                  {coverage.notes.notFollowedEntries} junctions or links were
                  recorded but not followed.
                </Typography>
                {review && (
                  <Typography variant="body2">
                    Discovery review (display only): {review.directories.reviewed}{' '}
                    directories reviewed, {review.directories.notReviewed} not
                    reviewed, {review.directories.unknown} without a result,{' '}
                    {review.directories.notExplored} not explored, across{' '}
                    {review.jobs.length} completed discovery{' '}
                    {review.jobs.length === 1 ? 'job' : 'jobs'}.
                    {review.truncated
                      ? ' Some jobs have more directories than are counted.'
                      : ''}
                  </Typography>
                )}
                <Typography variant="body2" className="text-neutral-400">
                  What this cannot promise:
                </Typography>
                <ul className="flex list-disc flex-col gap-1 pl-6">
                  {coverage.limits.map((limit) => (
                    <li key={limit}>
                      <Typography variant="body2" component="span">
                        {limit}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </Panel>
            </>
          )}
        </>
      )}
    </main>
  );
}
