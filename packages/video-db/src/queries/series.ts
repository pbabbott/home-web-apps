import { eq } from 'drizzle-orm';
import type { Database } from '../client';
import { series, type Series } from '../schema/series';

/** Every supported series, alphabetical by display name. */
export const listSeries = async (db: Database): Promise<Series[]> =>
  db.select().from(series).orderBy(series.seriesName);

export const getSeriesById = async (
  db: Database,
  id: string,
): Promise<Series | undefined> => {
  const [row] = await db.select().from(series).where(eq(series.id, id));

  return row;
};

export const getSeriesByName = async (
  db: Database,
  seriesName: string,
): Promise<Series | undefined> => {
  const [row] = await db
    .select()
    .from(series)
    .where(eq(series.seriesName, seriesName));

  return row;
};
