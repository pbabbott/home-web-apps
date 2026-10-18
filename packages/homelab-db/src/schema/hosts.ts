import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const hostTypeEnum = pgEnum('host_type', ['physical', 'virtual']);

/**
 * Which Prometheus exporter a host is scraped by — decides which metric
 * names/labels homelab-api queries for it (node_exporter on Linux,
 * windows_exporter on Windows).
 */
export const exporterTypeEnum = pgEnum('exporter_type', [
  'node_exporter',
  'windows_exporter',
]);

/**
 * A user-managed record of a homelab host, matched up to Prometheus data via
 * instance — the scrape-target address (e.g. "192.168.6.24:9100") that
 * Prometheus stamps as the `instance` label on every exporter metric (see
 * exporterType). instance is nullable/unique: a host can be registered
 * before an exporter is scraping it (or never match one), and when set it
 * must point at exactly one host.
 */
export const hosts = pgTable('hosts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  hostType: hostTypeEnum('host_type').notNull().default('physical'),
  exporterType: exporterTypeEnum('exporter_type')
    .notNull()
    .default('node_exporter'),
  ipAddress: text('ip_address').notNull(),
  instance: text('instance').unique(),
  /**
   * Slug of a procedural 3D model (apps/home-hud/src/app/infra/viz/models/
   * <slug>/) to render in this host's detail panel, in place of the
   * placeholder — null means no model. Free text, not a pgEnum: new models
   * get added to the viz collection without a DB migration (see
   * docs/home-hud-3d-model-guide.md), so the valid-slug set is enforced at
   * the API/UI layer, not the column type.
   */
  model3d: text('model3d'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Host = typeof hosts.$inferSelect;
export type NewHost = typeof hosts.$inferInsert;
export type HostType = (typeof hostTypeEnum.enumValues)[number];
export type ExporterType = (typeof exporterTypeEnum.enumValues)[number];

const dateTime = (schema: z.ZodDate) => schema.meta({ format: 'date-time' });

/**
 * Zod schema derived directly from the hosts table, so a column
 * added/renamed/retyped here is reflected everywhere this is consumed
 * (currently: homelab-api's generated OpenAPI docs) without hand-editing.
 */
export const hostSelectSchema = createSelectSchema(hosts, {
  createdAt: dateTime,
});
