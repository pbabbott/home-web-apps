import { REVIEW_LABELS } from './inventory-display';
import type {
  AuditEvent,
  AuditEventType,
  ReviewDisposition,
} from '../sources/lib/homelab-api';

export const AUDIT_EVENT_LABELS: Record<AuditEventType, string> = {
  'exclusion_rule.created': 'Rule created',
  'exclusion_rule.updated': 'Rule updated',
  'exclusion_rule.deleted': 'Rule removed',
  'inventory_item.review_changed': 'Reviewed',
  'inventory_item.review_bulk_changed': 'Bulk review',
  'queue_items.excluded': 'Queue skipped',
};

/** Own keys only: `in` would also accept `toString` and the like. */
const hasKey = (record: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

/** An audit event type from a URL parameter; anything else means "all". */
export function parseAuditEventType(
  value: string | undefined,
): AuditEventType | undefined {
  return value !== undefined && hasKey(AUDIT_EVENT_LABELS, value)
    ? (value as AuditEventType)
    : undefined;
}

const SCOPE_WORDS: Record<string, string> = {
  exclude_subtree: 'exclude subtree',
  selective_only: 'selective only',
};

const scopeWord = (scope: unknown): string =>
  typeof scope === 'string' ? (SCOPE_WORDS[scope] ?? scope) : '?';

const reviewWord = (value: unknown): string =>
  typeof value === 'string' && hasKey(REVIEW_LABELS, value)
    ? REVIEW_LABELS[value as ReviewDisposition]
    : '?';

/** The `details` shapes the API writes; every field may be missing. */
interface AuditDetails {
  path?: string;
  scope?: string;
  global?: boolean;
  reason?: string;
  before?: { scope?: string };
  after?: { scope?: string };
  from?: string;
  to?: string;
  disposition?: string;
  changed?: unknown[];
  count?: number;
}

/** One line saying what an event did, built from its `details`. */
export function describeAuditEvent(event: AuditEvent): string {
  const d = (event.details ?? {}) as AuditDetails;

  switch (event.eventType) {
    case 'exclusion_rule.created':
      return `${d.path ?? '?'} (${scopeWord(d.scope)}, ${d.global ? 'all sources' : 'one source'})${d.reason ? `: ${d.reason}` : ''}`;
    case 'exclusion_rule.updated':
      return `${d.path ?? '?'}: ${scopeWord(d.before?.scope)} → ${scopeWord(d.after?.scope)}`;
    case 'exclusion_rule.deleted':
      return `${d.path ?? '?'} (${scopeWord(d.scope)})`;
    case 'inventory_item.review_changed':
      return `${d.path ?? '?'}: ${reviewWord(d.from)} → ${reviewWord(d.to)}`;
    case 'inventory_item.review_bulk_changed': {
      const changed = Array.isArray(d.changed) ? d.changed.length : 0;

      return `${changed} item${changed === 1 ? '' : 's'} → ${reviewWord(d.disposition)}`;
    }
    case 'queue_items.excluded':
      return `${d.count ?? '?'} queued director${d.count === 1 ? 'y' : 'ies'} skipped by an exclusion rule`;
  }
}

export interface AuditView {
  source?: string;
  type?: AuditEventType;
  /** Cursor: the id of the last event of the previous page. */
  before?: string;
}

const AUDIT_PATH = '/exodus/audit';

/** Page URL for a view; defaults are left out so URLs stay short and shareable. */
export function auditUrl(view: AuditView): string {
  const params = new URLSearchParams();

  if (view.source) params.set('source', view.source);
  if (view.type) params.set('type', view.type);
  if (view.before) params.set('before', view.before);

  const query = params.toString();

  return query ? `${AUDIT_PATH}?${query}` : AUDIT_PATH;
}
