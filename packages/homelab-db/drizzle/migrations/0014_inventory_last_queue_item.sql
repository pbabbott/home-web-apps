ALTER TABLE "inventory_items" ADD COLUMN "last_queue_item_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_last_queue_item_id_discovery_queue_items_id_fk" FOREIGN KEY ("last_queue_item_id") REFERENCES "public"."discovery_queue_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_items_last_queue_item_idx" ON "inventory_items" USING btree ("last_queue_item_id");
--> statement-breakpoint
-- One-time backfill from the audit log (never read at query time): the latest
-- event that tied each inventory item to a queue item that still exists.
UPDATE "inventory_items" AS i
SET "last_queue_item_id" = latest."queue_item_id"
FROM (
	SELECT DISTINCT ON (e."inventory_item_id") e."inventory_item_id", e."queue_item_id"
	FROM "audit_events" AS e
	INNER JOIN "discovery_queue_items" AS q ON q."id" = e."queue_item_id"
	WHERE e."inventory_item_id" IS NOT NULL
		AND e."event_type" IN ('inventory_item.created', 'inventory_item.recommendation_changed', 'inventory_item.promoted')
	ORDER BY e."inventory_item_id", e."created_at" DESC
) AS latest
WHERE i."id" = latest."inventory_item_id";
