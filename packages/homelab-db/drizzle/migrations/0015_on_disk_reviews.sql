CREATE TABLE "on_disk_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"path" text NOT NULL,
	"normalized_path" text NOT NULL,
	"queue_item_id" uuid,
	"reviewed_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "on_disk_reviews" ADD CONSTRAINT "on_disk_reviews_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "on_disk_reviews" ADD CONSTRAINT "on_disk_reviews_queue_item_id_discovery_queue_items_id_fk" FOREIGN KEY ("queue_item_id") REFERENCES "public"."discovery_queue_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "on_disk_reviews_source_path_unique" ON "on_disk_reviews" USING btree ("source_id","normalized_path");