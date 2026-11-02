import {
  ScrollableTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
  Typography,
} from '@abbottland/fui-components';
import { relativeToDirectory } from '../../../../lib/job-display';
import type { QueueItemDetail } from '../../../../sources/lib/homelab-api';
import { Section } from './Section';

interface UnreadableSectionProps {
  item: QueueItemDetail;
}

export function UnreadableSection({ item }: UnreadableSectionProps) {
  const result = item.result;

  return (
    <Section
      title={<>Unreadable directories · {result?.unreadable?.length ?? 0}</>}
      empty={
        !result
          ? 'Not explored yet.'
          : !result.unreadable?.length
            ? 'None.'
            : undefined
      }
    >
      <Typography variant="body2" className="text-neutral-400">
        Failed; retry once access is granted.
      </Typography>
      <ScrollableTable className="mb-0">
        <Table size="small" color="secondary">
          <TableHead>
            <TableRow>
              <Th color="secondary">Path</Th>
              <Th color="secondary">Error</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {(result?.unreadable ?? []).map((entry) => (
              <TableRow key={entry.path}>
                <Td color="secondary" className="break-all">
                  {relativeToDirectory(item.path, entry.path)}
                </Td>
                <Td color="secondary" className="text-neutral-400">
                  {entry.error}
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollableTable>
    </Section>
  );
}
