import { sql, type SQL } from 'drizzle-orm';
import type { Database } from '../client';

export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * A rule violation the caller can act on: the row is missing (`not_found`)
 * or the request conflicts with current state (`conflict`) — a duplicate
 * name, an illegal status transition, a lost lease. `details` carries
 * structured context (e.g. queue counts blocking job completion).
 */
export class DiscoveryError extends Error {
  constructor(
    readonly code: 'not_found' | 'conflict',
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

/** Escapes LIKE wildcards (with `!` as the escape character) so a prefix is matched literally. */
export const escapeLike = (value: string): string =>
  value.replace(/[!%_]/g, '!$&');

/** SQL form of `covers`: the root path equals the path or is an ancestor of it. */
export const coversSql = (rootPath: SQL | unknown, path: SQL | unknown): SQL =>
  sql`(${path} = ${rootPath} or starts_with(${path}, case when right(${rootPath}, 1) = ${'\\'}::text then ${rootPath} else ${rootPath} || ${'\\'}::text end))`;

/** Most queue item ids an audit event lists; the rest are only counted. */
export const MAX_AUDITED_ITEM_IDS = 100;
