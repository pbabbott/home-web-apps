CREATE TABLE "skip_acknowledgements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"path" text NOT NULL,
	"normalized_path" text NOT NULL,
	"pattern" text DEFAULT '' NOT NULL,
	"queue_item_id" uuid,
	"acknowledged_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "skip_acknowledgements" ADD CONSTRAINT "skip_acknowledgements_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skip_acknowledgements" ADD CONSTRAINT "skip_acknowledgements_queue_item_id_discovery_queue_items_id_fk" FOREIGN KEY ("queue_item_id") REFERENCES "public"."discovery_queue_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "skip_acknowledgements_source_path_pattern_unique" ON "skip_acknowledgements" USING btree ("source_id","normalized_path","pattern");