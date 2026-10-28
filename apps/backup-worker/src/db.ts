import { createDb, type Database } from '@abbottland/homelab-db';
import { config } from './config';

export let db: Database;

export const initDb = () => {
  db = createDb(config.postgres);
};
