import * as dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

dotenv.config();

export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './src/schema/budget-jobs.ts',
    './src/schema/ynab-raw-responses.ts',
    './src/schema/ynab-sync-state.ts',
  ],
  out: './drizzle/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
