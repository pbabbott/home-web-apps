import type { AuditEvent, AuditEventType } from '../sources/lib/homelab-api';

export const AUDIT_EVENT_LABELS: Record<AuditEventType, string> = {
  'exclusion_rule.created': 'Rule created',
  'exclusion_rule.updated': 'Rule updated',
  'exclusion_rule.deleted': 'Rule removed',
  'queue_items.excluded': 'Queue skipped',
  'queue_items.inventoried': 'Queue skipped (inventoried)',
  'inventory_item.created': 'Inventory item proposed',
  'inventory_item.recommendation_changed': 'Recommendation changed',
  'inventory_item.decision_changed': 'Inventory item decided',
  'inventory_item.promoted': 'Promoted from skipped',
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

const RECOMMENDATION_WORDS: Record<string, string> = {
  back_up: 'back up',
  skip: 'skip',
  needs_review: 'needs review',
};

const recommendationWord = (value: unknown): string =>
  typeof value === 'string' ? (RECOMMENDATION_WORDS[value] ?? value) : '?';

const decisionWord = (value: unknown): string =>
  typeof value === 'string' ? value : '?';

/** The `details` shapes the API writes; every field may be missing. */
interface AuditDetails {
  path?: string;
  scope?: string;
  global?: boolean;
  reason?: string;
  before?: { scope?: string };
  after?: { scope?: string };
  recommendation?: string;
  confidence?: string;
  from?: string | { recommendation?: string; confidence?: string };
  to?: string | { recommendation?: string; confidence?: string };
  count?: number;
  skipReason?: string | null;
  wholeDirectory?: boolean;
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
    case 'inventory_item.created':
      return `${d.path ?? '?'}: ${recommendationWord(d.recommendation)} (${d.confidence ?? '?'} confidence)`;
    case 'inventory_item.recommendation_changed': {
      const from = typeof d.from === 'object' ? d.from : undefined;
      const to = typeof d.to === 'object' ? d.to : undefined;

      return `${d.path ?? '?'}: ${recommendationWord(from?.recommendation)} → ${recommendationWord(to?.recommendation)}`;
    }
    case 'inventory_item.decision_changed':
      return `${d.path ?? '?'}: ${decisionWord(d.from)} → ${decisionWord(d.to)}`;
    case 'inventory_item.promoted':
      return `${d.path ?? '?'}${d.wholeDirectory ? ': added as a whole directory' : ''}${d.skipReason ? `: was skipped as "${d.skipReason}"` : ''}`;
    case 'queue_items.excluded':
      return `${d.count ?? '?'} queued director${d.count === 1 ? 'y' : 'ies'} skipped by an exclusion rule`;
    case 'queue_items.inventoried':
      return `${d.count ?? '?'} queued director${d.count === 1 ? 'y' : 'ies'} skipped: inside an approved directory`;
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
