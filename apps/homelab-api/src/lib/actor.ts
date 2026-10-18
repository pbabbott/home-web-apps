import type { Actor } from '@abbottland/homelab-db';
import type { RequestHandler, Response } from 'express';
import { z } from 'zod';

/**
 * Who made a change, for audit events. There is no authentication yet, so the
 * caller says who it is with optional headers; this is attribution for
 * debugging, not an access-control boundary.
 */
const actorHeadersSchema = z.object({
  'x-actor-type': z.enum(['human', 'openclaw', 'system']).default('human'),
  'x-actor-id': z.string().trim().min(1).max(200).optional(),
});

/** Parses the actor headers into res.locals.actor, or answers 400. */
export const parseActor: RequestHandler = (req, res, next) => {
  const parsed = actorHeadersSchema.safeParse({
    'x-actor-type': req.get('x-actor-type'),
    'x-actor-id': req.get('x-actor-id'),
  });

  if (!parsed.success) {
    res.status(400).json({
      message: 'Invalid actor headers',
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    });
    return;
  }

  res.locals.actor = {
    type: parsed.data['x-actor-type'],
    id: parsed.data['x-actor-id'] ?? null,
  } satisfies Actor;
  next();
};

export const actorOf = (res: Response): Actor => res.locals.actor as Actor;
