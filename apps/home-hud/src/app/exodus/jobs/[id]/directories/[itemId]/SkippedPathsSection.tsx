import Link from 'next/link';
import {
  OutlinedButton,
  ScrollableTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
} from '@abbottland/fui-components';
import { AcknowledgeControl } from '../../../../lib/DirectoryReview';
import { inventoryItemUrl } from '../../../../lib/inventory-display';
import { relativeToDirectory } from '../../../../lib/job-display';
import { PreviewButton } from '../../../../lib/PreviewButton';
import type { QueueItemDetail } from '../../../../sources/lib/homelab-api';
import { Section } from './Section';

interface SkippedPathsSectionProps {
  item: QueueItemDetail;
  /** A review change is in flight. */
  pending: boolean;
  onSetReviewed: (path: string, pattern: string, reviewed: boolean) => void;
  onPromote: (skip: { path: string; reason: string }) => void;
}

export function SkippedPathsSection({
  item,
  pending,
  onSetReviewed,
  onPromote,
}: SkippedPathsSectionProps) {
  const { job, skipReview } = item;
  const sourceId = job.sourceId;
  const result = item.result;
  const skippedPaths = result?.skipped ?? [];
  const reviewedPaths = skipReview.paths.filter(
    (p) => p.acknowledged || p.inventoried,
  ).length;

  return (
    <Section
      title={
        <>
          Skipped paths · {reviewedPaths} / {skippedPaths.length} reviewed
        </>
      }
      empty={
        !result
          ? 'Not explored yet.'
          : skippedPaths.length === 0
            ? 'None.'
            : undefined
      }
    >
      <ScrollableTable className="mb-0">
        <Table size="small" color="secondary">
          <TableHead>
            <TableRow>
              <Th color="secondary">Review</Th>
              <Th color="secondary">Path</Th>
              <Th color="secondary">Reason</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {skippedPaths.map((skip, i) => (
              <TableRow key={skip.path}>
                <Td color="secondary">
                  <div className="flex flex-wrap items-center gap-2">
                    {skipReview.paths[i]?.inventoried ? (
                      <Link
                        href={inventoryItemUrl(sourceId, skip.path)}
                        className="text-neutral-400 underline"
                      >
                        In inventory
                      </Link>
                    ) : (
                      <>
                        <AcknowledgeControl
                          acknowledged={
                            skipReview.paths[i]?.acknowledged ?? false
                          }
                          disabled={pending}
                          onAcknowledge={() =>
                            onSetReviewed(skip.path, '', true)
                          }
                          onUndo={() => onSetReviewed(skip.path, '', false)}
                        />
                        <OutlinedButton
                          size="small"
                          color="secondary"
                          onClick={() =>
                            onPromote({
                              path: skip.path,
                              reason: skip.reason,
                            })
                          }
                        >
                          Promote
                        </OutlinedButton>
                      </>
                    )}
                  </div>
                </Td>
                <Td color="secondary" className="break-all">
                  <div className="flex items-center gap-2">
                    <PreviewButton sourceId={sourceId} path={skip.path} />
                    <span>{relativeToDirectory(item.path, skip.path)}</span>
                  </div>
                </Td>
                <Td color="secondary" className="text-neutral-400">
                  {skip.reason}
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollableTable>
    </Section>
  );
}
