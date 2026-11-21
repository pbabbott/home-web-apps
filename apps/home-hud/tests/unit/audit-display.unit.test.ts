import {
  AUDIT_EVENT_LABELS,
  auditEventLabel,
  auditUrl,
  describeAuditEvent,
  parseAuditEventType,
} from '../../src/app/exodus/lib/audit-display';
import type { AuditEvent } from '../../src/app/exodus/sources/lib/homelab-api';

const event = (
  eventType: AuditEvent['eventType'],
  details: AuditEvent['details'],
): AuditEvent => ({
  id: 'e1',
  sourceId: null,
  jobId: null,
  inventoryItemId: null,
  eventType,
  actorType: 'human',
  actorId: null,
  details,
  createdAt: '2026-10-18T12:00:00.000Z',
});

describe('describeAuditEvent', () => {
  it('describes inventory item events', () => {
    expect(
      describeAuditEvent(
        event('inventory_item.created', {
          path: 'C:\\code\\a',
          recommendation: 'back_up',
          confidence: 'high',
        }),
      ),
    ).toBe('C:\\code\\a: back up (high confidence)');
    expect(
      describeAuditEvent(
        event('inventory_item.recommendation_changed', {
          path: 'C:\\code\\a',
          from: { recommendation: 'needs_review', confidence: 'low' },
          to: { recommendation: 'skip', confidence: 'high' },
        }),
      ),
    ).toBe('C:\\code\\a: needs review → skip');
    expect(
      describeAuditEvent(
        event('inventory_item.decision_changed', {
          path: 'C:\\code\\a',
          from: 'pending',
          to: 'approved',
        }),
      ),
    ).toBe('C:\\code\\a: pending → approved');
  });

  it('describes queue items skipped inside an approved directory', () => {
    expect(
      describeAuditEvent(event('queue_items.inventoried', { count: 15 })),
    ).toBe('15 queued directories skipped: inside an approved directory');
    expect(
      describeAuditEvent(event('queue_items.inventoried', { count: 1 })),
    ).toBe('1 queued directory skipped: inside an approved directory');
  });

  it('survives missing details', () => {
    expect(describeAuditEvent(event('inventory_item.created', null))).toBe(
      '?: ? (? confidence)',
    );
  });
});

describe('parseAuditEventType', () => {
  it('accepts known types and ignores anything else', () => {
    expect(parseAuditEventType('inventory_item.created')).toBe(
      'inventory_item.created',
    );
    expect(parseAuditEventType('bogus')).toBeUndefined();
    expect(parseAuditEventType('toString')).toBeUndefined();
    expect(parseAuditEventType(undefined)).toBeUndefined();
  });
});

describe('auditUrl', () => {
  it('leaves defaults out', () => {
    expect(auditUrl({})).toBe('/exodus/audit');
  });

  it('keeps every view option', () => {
    const url = auditUrl({
      source: 's1',
      type: 'queue_items.inventoried',
      before: 'e9',
    });
    const params = new URL(url, 'http://x').searchParams;

    expect(params.get('source')).toBe('s1');
    expect(params.get('type')).toBe('queue_items.inventoried');
    expect(params.get('before')).toBe('e9');
  });
});

describe('backup events', () => {
  it('describes a created job by item counts', () => {
    expect(
      describeAuditEvent(
        event('backup_job.created', {
          items: { queued: 2, skipped: 1 },
          sourceDirName: 'elder-wand',
        }),
      ),
    ).toBe('2 queued, 1 skipped: elder-wand');
  });

  it('describes a verified item and a failed attempt', () => {
    expect(
      describeAuditEvent(
        event('backup_job_item.verified', { attemptCount: 1 }),
      ),
    ).toBe('attempt 1');
    expect(
      describeAuditEvent(
        event('backup_job_item.failed', {
          attemptCount: 3,
          maxAttempts: 3,
          error: 'boom',
        }),
      ),
    ).toBe('attempt 3 of 3: boom');
  });

  it('never returns undefined, even without details', () => {
    for (const type of Object.keys(AUDIT_EVENT_LABELS)) {
      const text = describeAuditEvent(
        event(type as AuditEvent['eventType'], null),
      );
      expect(typeof text).toBe('string');
    }
  });

  it('labels an unknown event type as itself', () => {
    expect(auditEventLabel('future.event' as AuditEvent['eventType'])).toBe(
      'future.event',
    );
  });
});
