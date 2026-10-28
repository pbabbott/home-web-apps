import {
  BackupError,
  getBackupCoverage,
  getSourceById,
  type BackupCoverageBucket,
  type BackupCoverageReport,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import type { BackupCoverageQuery } from '../../schemas/backup/coverage';
import { requireDestination } from './destinations';
import {
  getDiscoveryReviewSummary,
  type DiscoveryReviewSummary,
} from './discovery-review';

export const COVERAGE_SCOPE =
  'Inventory items, with per-file verification for directory items, subject to the stated limits.';

/** What coverage cannot promise (plan §4.5). Shown with every report. */
export const COVERAGE_LIMITS = [
  'Files hidden from the SMB account are invisible: enumeration cannot prove they do not exist.',
  'Coverage is of the inventory, not the whole disk. Whether the inventory is complete is the discovery workflow’s job.',
  'A file modified during the copy (a consistent but different version) is not detected.',
  'ACLs and alternate-stream contents other than Zone.Identifier are not preserved.',
  'The copy changes the source’s last-access times; the originals are recorded in the database.',
];

export type BackupCoverageResponse = Omit<BackupCoverageReport, 'items'> & {
  source: { id: string; name: string };
  destination: { id: string; name: string };
  scope: string;
  limits: string[];
  /** Display only; does not affect `allAccounted`. */
  discoveryReview: DiscoveryReviewSummary;
  /** Rejected items are final and counted, but not listed unless asked for (`bucket=rejected`) or in the JSON download. */
  omittedRejected: number;
  items: BackupCoverageReport['items'];
};

/**
 * The coverage report for one source at one destination. The full report
 * (`full`: the JSON download) lists every item; the default listing leaves the
 * rejected ones out, since rejected means “final, do not back up”.
 */
export async function getCoverage(
  sourceId: string,
  query: Pick<BackupCoverageQuery, 'destinationId' | 'bucket'>,
  full = false,
): Promise<BackupCoverageResponse> {
  const source = await getSourceById(db, sourceId);
  if (!source) throw new BackupError('not_found', 'source not found');
  const destination = await requireDestination(query.destinationId);

  const bucket: BackupCoverageBucket | undefined = full
    ? undefined
    : query.bucket;
  const [report, discoveryReview] = await Promise.all([
    getBackupCoverage(db, {
      sourceId,
      destinationId: destination.id,
      bucket,
    }),
    getDiscoveryReviewSummary(sourceId),
  ]);

  const hideRejected = !full && !bucket;

  return {
    ...report,
    source: { id: source.id, name: source.name },
    destination: { id: destination.id, name: destination.name },
    scope: COVERAGE_SCOPE,
    limits: COVERAGE_LIMITS,
    discoveryReview,
    omittedRejected: hideRejected ? report.counts.rejected : 0,
    items: hideRejected
      ? report.items.filter((i) => i.bucket !== 'rejected')
      : report.items,
  };
}
