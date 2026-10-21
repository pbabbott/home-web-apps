-- Inventory items replace the per-path inventory rows: one row per path the
-- agent proposes for backup, with a recommendation and a human decision.
-- The old rows and their review events are dropped; exodus held no data worth
-- carrying over.
DELETE FROM "audit_events" WHERE "event_type" IN ('inventory_item.review_changed', 'inventory_item.review_bulk_changed');--> statement-breakpoint
DROP TABLE "inventory_items";--> statement-breakpoint
DROP TYPE "public"."review_disposition";--> statement-breakpoint
DROP TYPE "public"."inventory_item_type";--> statement-breakpoint
CREATE TYPE "public"."inventory_item_confidence" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."inventory_item_decision" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."inventory_item_kind" AS ENUM('file', 'directory');--> statement-breakpoint
CREATE TYPE "public"."inventory_item_recommendation" AS ENUM('back_up', 'skip', 'needs_review');--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"first_job_id" uuid,
	"last_job_id" uuid,
	"kind" "inventory_item_kind" NOT NULL,
	"root_path" text NOT NULL,
	"normalized_root_path" text NOT NULL,
	"display_name" text NOT NULL,
	"summary" text NOT NULL,
	"recommendation" "inventory_item_recommendation" NOT NULL,
	"confidence" "inventory_item_confidence" NOT NULL,
	"recommendation_reason" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"recommended_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recommended_by" text,
	"decision" "inventory_item_decision" DEFAULT 'pending' NOT NULL,
	"decision_note" text,
	"decided_at" timestamp with time zone,
	"decided_by" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_items_decided_check" CHECK ("inventory_items"."decision" = 'pending' or "inventory_items"."decided_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "discovery_queue_items" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "discovery_queue_items" ADD COLUMN "result" jsonb;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_first_job_id_discovery_jobs_id_fk" FOREIGN KEY ("first_job_id") REFERENCES "public"."discovery_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_last_job_id_discovery_jobs_id_fk" FOREIGN KEY ("last_job_id") REFERENCES "public"."discovery_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_source_path_unique" ON "inventory_items" USING btree ("source_id","normalized_root_path");--> statement-breakpoint
CREATE INDEX "inventory_items_decision_idx" ON "inventory_items" USING btree ("source_id","decision");--> statement-breakpoint
CREATE INDEX "inventory_items_recommendation_idx" ON "inventory_items" USING btree ("source_id","recommendation");--> statement-breakpoint
CREATE INDEX "inventory_items_last_job_idx" ON "inventory_items" USING btree ("last_job_id");
