import * as discoveryService from '../../services/discovery';
import { handle } from './handle';
import type { Operation } from '../operation';
import type { AuditEventListQuery } from '../../schemas/discovery';

// Does: page through the append-only audit log, newest first.
// Who: human (home-hud). No MCP tool.
export const listAuditEventsOperation = {
  summary: 'List audit events',
  description:
    'Changes to exclusion rules, inventory items (created, recommendation changed, decision changed), newest first. Up to `limit` (default 100, max 500) per page; pass the last event’s id as `before` for the next page. Read-only: events are only ever appended by the operations they describe.',
} satisfies Operation;

export const listAuditEvents = handle('GET /audit-events', async (req, res) => {
  const filters = req.query as unknown as AuditEventListQuery;
  res.status(200).json(await discoveryService.listAuditEvents(filters));
});
