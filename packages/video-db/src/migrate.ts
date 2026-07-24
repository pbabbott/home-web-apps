import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema/video-jobs';
import { runMigrations } from './migrations';

const run = async () => {
  dotenv.config();

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required to run migrations.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  await runMigrations(db);
  await pool.end();

  console.log('Migrations complete.');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
