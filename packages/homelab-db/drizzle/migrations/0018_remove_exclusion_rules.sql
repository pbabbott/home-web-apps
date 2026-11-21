DELETE FROM "audit_events" WHERE "event_type" IN ('exclusion_rule.created', 'exclusion_rule.updated', 'exclusion_rule.deleted', 'queue_items.excluded');--> statement-breakpoint
ALTER TABLE "exclusion_rules" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "exclusion_rules" CASCADE;--> statement-breakpoint
DROP INDEX "audit_events_rule_idx";--> statement-breakpoint
ALTER TABLE "audit_events" DROP COLUMN "exclusion_rule_id";--> statement-breakpoint
DROP TYPE "public"."exclusion_rule_scope";