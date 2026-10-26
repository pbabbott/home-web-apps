import {
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
  exclusionRuleId: null,
  inventoryItemId: null,
  eventType,
  actorType: 'human',
  actorId: null,
  details,
  createdAt: '2026-10-18T12:00:00.000Z',
});

describe('describeAuditEvent', () => {
  it('describes a created rule with its scope, reach and reason', () => {
    expect(
      describeAuditEvent(
        event('exclusion_rule.created', {
          path: 'C:\\app\\dist',
          scope: 'exclude_subtree',
          global: false,
          reason: 'build output',
        }),
      ),
    ).toBe('C:\\app\\dist (exclude subtree, one source): build output');
  });

  it('describes a global rule without a reason', () => {
    expect(
      describeAuditEvent(
        event('exclusion_rule.created', {
          path: 'C:\\Windows',
          scope: 'exclude_subtree',
          global: true,
          reason: null,
        }),
      ),
    ).toBe('C:\\Windows (exclude subtree, all sources)');
  });

  it('describes an update and a removal', () => {
    expect(
      describeAuditEvent(
        event('exclusion_rule.updated', {
          path: 'C:\\x',
          before: { scope: 'selective_only' },
          after: { scope: 'exclude_subtree' },
        }),
      ),
    ).toBe('C:\\x: selective only → exclude subtree');
    expect(
      describeAuditEvent(
        event('exclusion_rule.deleted', {
          path: 'C:\\x',
          scope: 'selective_only',
        }),
      ),
    ).toBe('C:\\x (selective only)');
  });

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

  it('describes skipped queue items', () => {
    expect(
      describeAuditEvent(event('queue_items.excluded', { count: 3 })),
    ).toBe('3 queued directories skipped by an exclusion rule');
    expect(
      describeAuditEvent(event('queue_items.excluded', { count: 1 })),
    ).toBe('1 queued directory skipped by an exclusion rule');
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
    expect(describeAuditEvent(event('exclusion_rule.deleted', null))).toBe(
      '? (?)',
    );
  });
});

describe('parseAuditEventType', () => {
  it('accepts known types and ignores anything else', () => {
    expect(parseAuditEventType('exclusion_rule.created')).toBe(
      'exclusion_rule.created',
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
      type: 'queue_items.excluded',
      before: 'e9',
    });
    const params = new URL(url, 'http://x').searchParams;

    expect(params.get('source')).toBe('s1');
    expect(params.get('type')).toBe('queue_items.excluded');
    expect(params.get('before')).toBe('e9');
  });
});
