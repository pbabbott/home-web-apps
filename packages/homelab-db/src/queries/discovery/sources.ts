import { eq } from 'drizzle-orm';
import type { Database } from '../../client';
import { isForeignKeyViolation, isUniqueViolation } from '../../pg-errors';
import { sources, type NewSource, type Source } from '../../schema/discovery';
import { DiscoveryError } from './errors';

// -- sources ---------------------------------------------------------

export type CreateSourceInput = Pick<
  NewSource,
  'name' | 'hostId' | 'sourceType'
>;

export const createSource = async (
  db: Database,
  input: CreateSourceInput,
): Promise<Source> => {
  try {
    const [row] = await db.insert(sources).values(input).returning();

    return row;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DiscoveryError(
        'conflict',
        `source named "${input.name}" already exists`,
      );
    }
    if (isForeignKeyViolation(err)) {
      throw new DiscoveryError('not_found', 'host not found');
    }
    throw err;
  }
};

export const listSources = async (db: Database): Promise<Source[]> =>
  db.select().from(sources).orderBy(sources.name);

export const getSourceById = async (
  db: Database,
  id: string,
): Promise<Source | undefined> => {
  const [row] = await db.select().from(sources).where(eq(sources.id, id));

  return row;
};
