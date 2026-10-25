import * as discoveryService from '../../services/discovery';
import { actorOf } from '../../lib/actor';
import { handle } from './handle';
import type { Operation } from '../operation';
import type {
  QueueItemIdParams,
  SkipAcknowledgementBody,
  SkipAcknowledgementListQuery,
  SourceIdParams,
} from '../../schemas/discovery';

// Does: let a human record that they agree with the agent skipping a path.
// Who: human only (REST). Deliberately no MCP tool.
export const acknowledgeSkipOperation = {
  summary: 'Acknowledge a skipped path',
  description:
    'Records that a human agrees with the agent’s decision to skip `path` (or, with `pattern`, the entries of the directory `path` matching it). The path must be inside the queue item’s directory. Kept per source, so it holds for later jobs that skip the same path; the queue item’s `result` is left as the agent wrote it. Idempotent. Writes a `skip.acknowledged` audit event the first time. Only a human actor may acknowledge (409 otherwise).',
  hud: '/exodus/jobs/[id]',
} satisfies Operation;

export const acknowledgeSkip = handle(
  'POST /queue-items/:id/skip-acknowledgements',
  async (req, res) => {
    const { id } = req.params as QueueItemIdParams;
    const body = req.body as SkipAcknowledgementBody;
    res
      .status(201)
      .json(await discoveryService.acknowledgeSkip(id, body, actorOf(res)));
  },
);

// Does: take a skip acknowledgement back.
// Who: human only (REST).
export const unacknowledgeSkipOperation = {
  summary: 'Remove a skip acknowledgement',
  description:
    'Takes back an acknowledgement given with the same `path` and `pattern`. 404 when there is none. Writes a `skip.unacknowledged` audit event. Only a human actor may do this (409 otherwise).',
  hud: '/exodus/jobs/[id]',
} satisfies Operation;

export const unacknowledgeSkip = handle(
  'DELETE /queue-items/:id/skip-acknowledgements',
  async (req, res) => {
    const { id } = req.params as QueueItemIdParams;
    const body = req.body as SkipAcknowledgementBody;
    await discoveryService.unacknowledgeSkip(id, body, actorOf(res));
    res.status(204).end();
  },
);

// Does: list a source's skip acknowledgements.
// Who: human (REST).
export const listSkipAcknowledgementsOperation = {
  summary: 'List skip acknowledgements',
  description:
    'A source’s acknowledged skips, ordered by path. Filter with `pathPrefix` (default limit 500, max 1000).',
  hud: '/exodus/jobs/[id]',
} satisfies Operation;

export const listSkipAcknowledgements = handle(
  'GET /sources/:id/skip-acknowledgements',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    const filters = req.query as unknown as SkipAcknowledgementListQuery;
    res
      .status(200)
      .json(await discoveryService.listSourceSkipAcknowledgements(id, filters));
  },
);
