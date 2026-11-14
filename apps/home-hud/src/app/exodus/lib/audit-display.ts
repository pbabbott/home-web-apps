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
  'skip.acknowledged': 'Skip acknowledged',
  'skip.unacknowledged': 'Skip acknowledgement removed',
  'on_disk.reviewed': 'On disk reviewed',
  'on_disk.unreviewed': 'On disk review removed',
  'source_connection.updated': 'Source connection saved',
  'source_connection.deleted': 'Source connection removed',
  'backup_destination.created': 'Destination created',
  'backup_destination.updated': 'Destination updated',
  'backup_destination.enabled': 'Destination enabled',
  'backup_destination.disabled': 'Destination disabled',
  'backup_destination.validated': 'Destination validated',
  'backup_destination.unhealthy': 'Destination unhealthy',
  'backup_job.created': 'Backup job created',
  'backup_job.started': 'Backup job started',
  'backup_job.completed': 'Backup job completed',
  'backup_job.completed_with_issues': 'Backup job completed with issues',
  'backup_job.cancelled': 'Backup job cancelled',
  'backup_job.failed': 'Backup job failed',
  'backup_job.stalled': 'Backup job stalled',
  'backup_job.resumed': 'Backup job resumed',
  'backup_job_item.verified': 'Backup item verified',
  'backup_job_item.attempt_failed': 'Backup item attempt failed',
  'backup_job_item.blocked': 'Backup item blocked',
  'backup_job_item.failed': 'Backup item failed',
  'backup_job_item.retried': 'Backup item retried',
  'backup_job_items.lease_expired': 'Backup item leases expired',
};

/** The label of an event type; an unknown one (newer API) shows as itself. */
export const auditEventLabel = (type: AuditEventType): string =>
  AUDIT_EVENT_LABELS[type] ?? type;

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
  pattern?: string;
  items?: Record<string, number>;
  sourceDirName?: string;
  error?: string;
  attemptCount?: number;
  maxAttempts?: number;
  kind?: string;
  created?: boolean;
  connectionType?: string;
  username?: string;
  passwordChanged?: boolean;
  name?: string;
  failed?: number;
  wasStalledFor?: string;
}

/** "3 verified, 1 skipped" from a status count map. */
const countsText = (counts: Record<string, number> | undefined): string =>
  Object.entries(counts ?? {})
    .map(([status, n]) => `${n} ${status.replaceAll('_', ' ')}`)
    .join(', ');

const attemptsText = (d: AuditDetails): string =>
  d.attemptCount === undefined
    ? ''
    : `attempt ${d.attemptCount}${d.maxAttempts ? ` of ${d.maxAttempts}` : ''}`;

const joinParts = (...parts: (string | undefined | false)[]): string =>
  parts.filter(Boolean).join(': ');

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
    case 'skip.acknowledged':
    case 'skip.unacknowledged':
      return `${d.path ?? '?'}${d.pattern ? ` (${d.pattern})` : ''}`;
    case 'on_disk.reviewed':
    case 'on_disk.unreviewed':
      return d.path ?? '?';
    case 'source_connection.updated':
      return `${d.created ? 'created' : 'updated'} ${d.connectionType ?? '?'} connection for ${d.username ?? '?'}${d.passwordChanged ? ' (password changed)' : ''}`;
    case 'source_connection.deleted':
      return `${d.connectionType ?? '?'} connection`;
    case 'backup_destination.created':
    case 'backup_destination.updated':
      return d.name ?? '';
    case 'backup_destination.unhealthy':
      return d.reason ?? '';
    case 'backup_job.created':
      return joinParts(countsText(d.items), d.sourceDirName);
    case 'backup_job.completed':
    case 'backup_job.completed_with_issues':
      return countsText(d.items);
    case 'backup_job.failed':
    case 'backup_job.cancelled':
      return d.error ?? '';
    case 'backup_job.stalled':
      return d.reason ?? '';
    case 'backup_job.resumed':
      return d.wasStalledFor ? `was stalled: ${d.wasStalledFor}` : '';
    case 'backup_job_item.verified':
    case 'backup_job_item.retried':
      return attemptsText(d);
    case 'backup_job_item.attempt_failed':
    case 'backup_job_item.blocked':
    case 'backup_job_item.failed':
      return joinParts(attemptsText(d), d.error);
    case 'backup_job_items.lease_expired':
      return `${d.count ?? '?'} item(s)${d.failed ? `, ${d.failed} failed` : ''}`;
    default:
      return '';
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
