import { parseAuditEventType } from '../lib/audit-display';
import {
  getAuditEvents,
  getSources,
  type AuditEvent,
  type Source,
} from '../sources/lib/homelab-api';
import { AuditClient } from './AuditClient';

type PageProps = {
  searchParams: Promise<{ source?: string; type?: string; before?: string }>;
};

const PAGE_SIZE = 50;

export default async function ExodusAuditPage({ searchParams }: PageProps) {
  const query = await searchParams;

  let sources: Source[] | null = null;

  try {
    sources = await getSources();
  } catch (err) {
    console.error('Failed to load sources from homelab-api:', err);
  }

  // Unlike the inventory page, "no source" means every source.
  const source = sources?.find((candidate) => candidate.id === query.source);
  const type = parseAuditEventType(query.type);
  const before = query.before || undefined;

  let events: AuditEvent[] | null = null;

  try {
    events = await getAuditEvents({
      sourceId: source?.id,
      eventType: type,
      before,
      limit: PAGE_SIZE,
    });
  } catch (err) {
    console.error('Failed to load audit events from homelab-api:', err);
  }

  return (
    <AuditClient
      sources={sources?.map(({ id, name }) => ({ id, name })) ?? []}
      sourceId={source?.id}
      type={type}
      isFirstPage={!before}
      events={events}
      // A full page may have more behind it; the cursor is the last row seen.
      nextCursor={
        events && events.length === PAGE_SIZE
          ? events[events.length - 1].id
          : null
      }
    />
  );
}
