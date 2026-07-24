import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/video-jobs';

export type Database = NodePgDatabase<typeof schema> & { $client: Pool };

export type PostgresConnectionOptions = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

export const createDb = (options: PostgresConnectionOptions): Database => {
  const pool = new Pool(options);

  return drizzle(pool, { schema });
};

export const closeDb = async (db: Database): Promise<void> => {
  await db.$client.end();
};

/** Throws if the database is unreachable. */
export const pingDb = async (db: Database): Promise<void> => {
  await db.execute(sql`select 1`);
};
