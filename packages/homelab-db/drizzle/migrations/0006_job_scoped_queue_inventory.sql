CREATE TYPE "public"."inventory_item_type" AS ENUM('file', 'directory');--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"first_job_id" uuid,
	"last_job_id" uuid,
	"item_type" "inventory_item_type" NOT NULL,
	"path" text NOT NULL,
	"normalized_path" text NOT NULL,
	"parent_path" text,
	"normalized_parent_path" text,
	"name" text NOT NULL,
	"extension" text,
	"size_bytes" bigint,
	"modified_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discovery_queue_items" DROP CONSTRAINT "discovery_queue_items_source_id_backup_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "discovery_queue_items" DROP CONSTRAINT "discovery_queue_items_job_id_discovery_jobs_id_fk";
--> statement-breakpoint
DROP INDEX "discovery_queue_items_source_path_unique";--> statement-breakpoint
DROP INDEX "discovery_queue_items_claim_idx";--> statement-breakpoint
DELETE FROM "discovery_queue_items" WHERE "job_id" IS NULL;--> statement-breakpoint
ALTER TABLE "discovery_queue_items" ALTER COLUMN "job_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_source_id_backup_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."backup_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_first_job_id_discovery_jobs_id_fk" FOREIGN KEY ("first_job_id") REFERENCES "public"."discovery_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_last_job_id_discovery_jobs_id_fk" FOREIGN KEY ("last_job_id") REFERENCES "public"."discovery_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_source_path_unique" ON "inventory_items" USING btree ("source_id","normalized_path");--> statement-breakpoint
CREATE INDEX "inventory_items_parent_idx" ON "inventory_items" USING btree ("source_id","normalized_parent_path");--> statement-breakpoint
CREATE INDEX "inventory_items_last_job_idx" ON "inventory_items" USING btree ("last_job_id");--> statement-breakpoint
CREATE INDEX "inventory_items_type_idx" ON "inventory_items" USING btree ("source_id","item_type");--> statement-breakpoint
ALTER TABLE "discovery_queue_items" ADD CONSTRAINT "discovery_queue_items_job_id_discovery_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."discovery_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_queue_items_job_path_unique" ON "discovery_queue_items" USING btree ("job_id","normalized_path");--> statement-breakpoint
CREATE INDEX "discovery_queue_items_claim_idx" ON "discovery_queue_items" USING btree ("job_id","status","priority" DESC NULLS LAST,"available_at");--> statement-breakpoint
ALTER TABLE "discovery_queue_items" DROP COLUMN "source_id";