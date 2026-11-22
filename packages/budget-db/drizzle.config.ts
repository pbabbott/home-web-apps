import * as dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

dotenv.config();

export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './src/schema/budget-jobs.ts',
    './src/schema/ynab-raw-responses.ts',
    './src/schema/ynab-sync-state.ts',
    './src/schema/ynab-lineage.ts',
    './src/schema/ynab-entities.ts',
    './src/schema/ynab-transactions.ts',
    './src/schema/ynab-months.ts',
    './src/schema/ynab-transform-state.ts',
    './src/schema/views/ynab-transactions-enriched.ts',
  ],
  out: './drizzle/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
