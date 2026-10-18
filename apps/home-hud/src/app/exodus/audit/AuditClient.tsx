'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  OutlinedButton,
  Panel,
  ScrollableTable,
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
  auditUrl,
  describeAuditEvent,
  parseAuditEventType,
} from '../lib/audit-display';
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <OutlinedButton type="button" size="small">
                {sourceNames.get(sourceId ?? '') ?? 'All sources'}
              </OutlinedButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent label="Source">
              <DropdownMenuItem
                onSelect={() => router.push(auditUrl({ ...view, source: '' }))}
              >
                All sources
              </DropdownMenuItem>
              {sources.map((source) => (
                <DropdownMenuItem
                  key={source.id}
                  onSelect={() =>
                    router.push(auditUrl({ ...view, source: source.id }))
                  }
                >
                  {source.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <Typography variant="small" className="text-neutral-400">
            Event
          </Typography>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <OutlinedButton type="button" size="small">
                {type ? AUDIT_EVENT_LABELS[type] : 'All events'}
              </OutlinedButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent label="Event">
              <DropdownMenuItem
                onSelect={() =>
                  router.push(auditUrl({ ...view, type: undefined }))
                }
              >
                All events
              </DropdownMenuItem>
              {Object.entries(AUDIT_EVENT_LABELS).map(([value, label]) => (
                <DropdownMenuItem
                  key={value}
                  onSelect={() =>
                    router.push(
                      auditUrl({ ...view, type: parseAuditEventType(value) }),
                    )
                  }
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
                  <Th>When (UTC)</Th>
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
                      {event.createdAt.slice(0, 10)}{' '}
                      {event.createdAt.slice(11, 19)}
                    </Td>
                    <Td>{AUDIT_EVENT_LABELS[event.eventType]}</Td>
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
