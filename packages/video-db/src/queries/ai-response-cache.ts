import { and, eq } from 'drizzle-orm';
import type { Database } from '../client';
import {
  aiResponseCache,
  type AiResponseCache,
  type NewAiResponseCache,
} from '../schema/ai-response-cache';

export type UpsertAiResponseCacheInput = Pick<
  NewAiResponseCache,
  'screenshotPath' | 'model' | 'response'
>;

/**
 * Inserts a cached AI response, or overwrites the existing one for the
 * same (screenshotPath, model) pair. Upsert (rather than insert-or-409)
 * because re-caching the same lookup is an expected, harmless occurrence.
 */
export const upsertAiResponseCache = async (
  db: Database,
  input: UpsertAiResponseCacheInput,
): Promise<AiResponseCache> => {
  const [row] = await db
    .insert(aiResponseCache)
    .values(input)
    .onConflictDoUpdate({
      target: [aiResponseCache.screenshotPath, aiResponseCache.model],
      set: { response: input.response },
    })
    .returning();

  return row;
};

export const getAiResponseCache = async (
  db: Database,
  screenshotPath: string,
  model: string,
): Promise<AiResponseCache | undefined> => {
  const [row] = await db
    .select()
    .from(aiResponseCache)
    .where(
      and(
        eq(aiResponseCache.screenshotPath, screenshotPath),
        eq(aiResponseCache.model, model),
      ),
    );

  return row;
};
