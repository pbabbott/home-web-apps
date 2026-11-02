import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { dateTime } from './shared';
import { sourceTypeEnum } from './enums';
import { hosts } from '../hosts';

/**
 * A machine/filesystem being inventoried for the exodus file migration.
 * hostId optionally ties it to a registered host (join on hosts.id for
 * name/IP); null for a machine that isn't registered. RESTRICT so deleting a
 * host can't silently wipe its discovery history.
 */
export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  hostId: uuid('host_id').references(() => hosts.id, { onDelete: 'restrict' }),
  sourceType: sourceTypeEnum('source_type').notNull().default('windows'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sourceConnectionTypeEnum = pgEnum('source_connection_type', [
  'smb',
]);

/** Connection options that are not secret; the shape depends on the type. */
export type SourceConnectionSettings = {
  /**
   * SMB only: which share serves a Windows path prefix, for machines where
   * the admin shares (`C$`) are unavailable. The longest matching prefix wins.
   */
  shareMappings?: { pathPrefix: string; share: string }[];
};

/**
 * How to authenticate to a source's filesystem so files can be previewed.
 * At most one per source. `secretCiphertext` is encrypted by the API and is
 * opaque here; it is never selected into API responses.
 */
export const sourceConnections = pgTable('source_connections', {
  sourceId: uuid('source_id')
    .primaryKey()
    .references(() => sources.id, { onDelete: 'cascade' }),
  connectionType: sourceConnectionTypeEnum('connection_type').notNull(),
  username: text('username').notNull(),
  domain: text('domain'),
  secretCiphertext: text('secret_ciphertext').notNull(),
  settings: jsonb('settings')
    .$type<SourceConnectionSettings>()
    .notNull()
    .default({}),
  lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
  lastTestOk: boolean('last_test_ok'),
  lastTestError: text('last_test_error'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SourceConnection = typeof sourceConnections.$inferSelect;
export type NewSourceConnection = typeof sourceConnections.$inferInsert;
export type SourceConnectionType =
  (typeof sourceConnectionTypeEnum.enumValues)[number];

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type SourceType = (typeof sourceTypeEnum.enumValues)[number];

export const sourceSelectSchema = createSelectSchema(sources, {
  createdAt: dateTime,
  updatedAt: dateTime,
});

/** Omits `secretCiphertext`: the secret never leaves the database layer. */
export const sourceConnectionSelectSchema = createSelectSchema(
  sourceConnections,
  {
    lastTestedAt: dateTime,
    createdAt: dateTime,
    updatedAt: dateTime,
  },
).omit({ secretCiphertext: true });
