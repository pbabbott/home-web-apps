'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Panel,
  ScrollableTable,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
  Typography,
} from '@abbottland/fui-components';
import {
  AUDIT_EVENT_LABELS,
  auditEventLabel,
  auditUrl,
  describeAuditEvent,
  parseAuditEventType,
} from '../lib/audit-display';
import { LocalDateTime } from '../lib/LocalDateTime';
import type { AuditEvent, AuditEventType } from '../sources/lib/homelab-api';

interface AuditClientProps {
  sources: { id: string; name: string }[];
  sourceId: string | undefined;
  type: AuditEventType | undefined;
  isFirstPage: boolean;
  /** Null if the log could not be loaded. */
  events: AuditEvent[] | null;
  nextCursor: string | null;
}

// Radix Select rejects an empty item value, so the "All …" items use this
// sentinel instead of '' / undefined.
const ALL = '__all__';

const ACTOR_COLORS = {
  human: 'primary',
  openclaw: 'accent-purple',
  system: 'dark',
} as const;

export function AuditClient({
  sources,
  sourceId,
  type,
  isFirstPage,
  events,
  nextCursor,
}: AuditClientProps) {
  const router = useRouter();
  const view = { source: sourceId, type };
  const sourceNames = new Map(sources.map((s) => [s.id, s.name]));

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
      <div className="flex flex-col gap-2">
        <Typography variant="h1" component="h1">
          Audit Log
        </Typography>
        <Typography variant="body2" className="text-neutral-400">
          Changes to exclusion rules and review decisions, newest first.
        </Typography>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Typography variant="small" className="text-neutral-400">
            Source
          </Typography>
          <Select
            // An unknown source id in the URL falls back to "All sources".
            value={sourceNames.has(sourceId ?? '') ? sourceId! : ALL}
            onValueChange={(value) =>
              router.push(
                auditUrl({ ...view, source: value === ALL ? '' : value }),
              )
            }
          >
            <SelectTrigger
              aria-label="Source"
              size="small"
              className="min-w-[160px]"
            />
            <SelectContent label="Source">
              <SelectItem value={ALL}>All sources</SelectItem>
              {sources.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Typography variant="small" className="text-neutral-400">
            Event
          </Typography>
          <Select
            value={type ?? ALL}
            onValueChange={(value) =>
              router.push(
                auditUrl({
                  ...view,
                  type: value === ALL ? undefined : parseAuditEventType(value),
                }),
              )
            }
          >
            <SelectTrigger
              aria-label="Event"
              size="small"
              className="min-w-[160px]"
            />
            <SelectContent label="Event">
              <SelectItem value={ALL}>All events</SelectItem>
              {Object.entries(AUDIT_EVENT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {events === null ? (
        <Typography variant="body2" className="text-error-400">
          Failed to load the audit log from homelab-api.
        </Typography>
      ) : events.length === 0 ? (
        <Typography variant="body2" className="text-neutral-400">
          {isFirstPage ? 'Nothing recorded yet.' : 'No more events.'}
        </Typography>
      ) : (
        <Panel color="default" className="flex flex-col gap-4">
          <ScrollableTable className="mb-0">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <Th>When</Th>
                  <Th>Event</Th>
                  <Th>What</Th>
                  <Th>Source</Th>
                  <Th>Actor</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <Td>
                      <LocalDateTime iso={event.createdAt} seconds />
                    </Td>
                    <Td>{auditEventLabel(event.eventType)}</Td>
                    <Td className="break-all">{describeAuditEvent(event)}</Td>
                    <Td>
                      {event.sourceId
                        ? (sourceNames.get(event.sourceId) ?? 'Unknown source')
                        : 'All sources'}
                    </Td>
                    <Td>
                      <Badge color={ACTOR_COLORS[event.actorType]}>
                        {event.actorId
                          ? `${event.actorType}: ${event.actorId}`
                          : event.actorType}
                      </Badge>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTable>

          {(!isFirstPage || nextCursor) && (
            <div className="flex items-center justify-between gap-3">
              {isFirstPage ? (
                <span />
              ) : (
                <Link
                  href={auditUrl(view)}
                  className="text-primary-400 hover:underline"
                >
                  <Typography variant="small" component="span">
                    ← Newest
                  </Typography>
                </Link>
              )}
              {nextCursor && (
                <Link
                  href={auditUrl({ ...view, before: nextCursor })}
                  className="text-primary-400 hover:underline"
                >
                  <Typography variant="small" component="span">
                    Older →
                  </Typography>
                </Link>
              )}
            </div>
          )}
        </Panel>
      )}
    </main>
  );
}
