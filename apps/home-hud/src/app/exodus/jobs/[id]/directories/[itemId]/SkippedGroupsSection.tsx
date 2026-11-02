import {
  ScrollableTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
} from '@abbottland/fui-components';
import { AcknowledgeControl } from '../../../../lib/DirectoryReview';
import type { QueueItemDetail } from '../../../../sources/lib/homelab-api';
import { Section } from './Section';

interface SkippedGroupsSectionProps {
  item: QueueItemDetail;
  /** A review change is in flight. */
  pending: boolean;
  onSetReviewed: (path: string, pattern: string, reviewed: boolean) => void;
  onViewPattern: (group: {
    pattern: string;
    count?: number;
    reason: string;
  }) => void;
}

export function SkippedGroupsSection({
  item,
  pending,
  onSetReviewed,
  onViewPattern,
}: SkippedGroupsSectionProps) {
  const { skipReview } = item;
  const result = item.result;
  const skippedGroups = result?.skippedGroups ?? [];
  const reviewedGroups = skipReview.patterns.filter(
    (p) => p.acknowledged,
  ).length;

  return (
    <Section
      title={
        <>
          Skipped by pattern · {reviewedGroups} / {skippedGroups.length}{' '}
          reviewed
        </>
      }
      empty={
        !result
          ? 'Not explored yet.'
          : skippedGroups.length === 0
            ? 'None.'
            : undefined
      }
    >
      <ScrollableTable className="mb-0">
        <Table size="small" color="secondary">
          <TableHead>
            <TableRow>
              <Th color="secondary">Review</Th>
              <Th color="secondary">Pattern</Th>
              <Th color="secondary">Count</Th>
              <Th color="secondary">Reason</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {skippedGroups.map((group, i) => (
              <TableRow key={group.pattern}>
                <Td color="secondary">
                  <AcknowledgeControl
                    acknowledged={skipReview.patterns[i]?.acknowledged ?? false}
                    disabled={pending}
                    onAcknowledge={() =>
                      onSetReviewed(item.path, group.pattern, true)
                    }
                    onUndo={() =>
                      onSetReviewed(item.path, group.pattern, false)
                    }
                  />
                </Td>
                <Td color="secondary" className="break-all">
                  <button
                    type="button"
                    title="Show the files this pattern matched"
                    onClick={() => onViewPattern(group)}
                    className="text-left underline decoration-dotted hover:text-primary-400"
                  >
                    {group.pattern}
                  </button>
                </Td>
                <Td color="secondary" className="text-neutral-400">
                  {group.count ?? '—'}
                </Td>
                <Td color="secondary" className="text-neutral-400">
                  {group.reason}
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollableTable>
    </Section>
  );
}
