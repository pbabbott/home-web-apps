-- Review candidates replaced inventory items. Reviewed inventory rows were
-- already carried over as candidates by 0010; the rest is dropped.
-- The pre-candidate review events described inventory items that no longer exist.
DELETE FROM "audit_events" WHERE "event_type" IN ('inventory_item.review_changed', 'inventory_item.review_bulk_changed');--> statement-breakpoint
DROP INDEX "audit_events_inventory_item_idx";--> statement-breakpoint
ALTER TABLE "audit_events" DROP COLUMN "inventory_item_id";--> statement-breakpoint
DROP TABLE "inventory_items";--> statement-breakpoint
ALTER TYPE "public"."inventory_item_type" RENAME TO "candidate_kind";
