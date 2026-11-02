import Link from 'next/link';
import {
  Badge,
  ScrollableTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
} from '@abbottland/fui-components';
import {
  DECISION_COLOR,
  DECISION_LABELS,
  RECOMMENDATION_COLOR,
  RECOMMENDATION_LABELS,
  inventoryItemUrl,
} from '../../../../lib/inventory-display';
import { comparePaths, relativeToDirectory } from '../../../../lib/job-display';
import type {
  InventoryItem,
  QueueItemDetail,
} from '../../../../sources/lib/homelab-api';
import { Section } from './Section';

interface InventoryItemsSectionProps {
  item: QueueItemDetail;
  /** Null if the inventory items could not be loaded. */
  inventoryItems: InventoryItem[] | null;
}

export function InventoryItemsSection({
  item,
  inventoryItems,
}: InventoryItemsSectionProps) {
  const sourceId = item.job.sourceId;
  const sortedInventory = [...(inventoryItems ?? [])].sort((a, b) =>
    comparePaths(a.rootPath, b.rootPath),
  );

  return (
    <Section
      title={<>Inventory items · {sortedInventory.length}</>}
      empty={
        inventoryItems === null
          ? 'Failed to load inventory items from homelab-api.'
          : sortedInventory.length === 0
            ? 'None.'
            : undefined
      }
    >
      <ScrollableTable className="mb-0">
        <Table size="small" color="secondary">
          <TableHead>
            <TableRow>
              <Th color="secondary">Decision</Th>
              <Th color="secondary">Path</Th>
              <Th color="secondary">Kind</Th>
              <Th color="secondary">Recommendation</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedInventory.map((inventoryItem) => (
              <TableRow key={inventoryItem.id}>
                <Td color="secondary">
                  <Badge color={DECISION_COLOR[inventoryItem.decision]}>
                    {DECISION_LABELS[inventoryItem.decision]}
                  </Badge>
                </Td>
                <Td color="secondary" className="break-all">
                  <Link
                    href={inventoryItemUrl(sourceId, inventoryItem.rootPath)}
                    className="underline"
                  >
                    {relativeToDirectory(item.path, inventoryItem.rootPath)}
                  </Link>
                </Td>
                <Td color="secondary">{inventoryItem.kind}</Td>
                <Td color="secondary">
                  <Badge
                    color={RECOMMENDATION_COLOR[inventoryItem.recommendation]}
                  >
                    {RECOMMENDATION_LABELS[inventoryItem.recommendation]}
                  </Badge>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollableTable>
    </Section>
  );
}
