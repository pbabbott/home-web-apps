CREATE TYPE "public"."backup_source_type" AS ENUM('windows');--> statement-breakpoint
CREATE TYPE "public"."discovery_job_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."discovery_queue_item_status" AS ENUM('queued', 'in_progress', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "backup_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"hostname" text NOT NULL,
	"source_type" "backup_source_type" DEFAULT 'windows' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "backup_sources_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "discovery_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"root_path" text NOT NULL,
	"normalized_root_path" text NOT NULL,
	"status" "discovery_job_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_queue_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"job_id" uuid,
	"path" text NOT NULL,
	"normalized_path" text NOT NULL,
	"status" "discovery_queue_item_status" DEFAULT 'queued' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_by" text,
	"claim_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "discovery_jobs" ADD CONSTRAINT "discovery_jobs_source_id_backup_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."backup_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_queue_items" ADD CONSTRAINT "discovery_queue_items_source_id_backup_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."backup_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_queue_items" ADD CONSTRAINT "discovery_queue_items_job_id_discovery_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."discovery_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_jobs_one_active_per_source" ON "discovery_jobs" USING btree ("source_id") WHERE "discovery_jobs"."status" in ('pending', 'running');--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_queue_items_source_path_unique" ON "discovery_queue_items" USING btree ("source_id","normalized_path");--> statement-breakpoint
CREATE INDEX "discovery_queue_items_claim_idx" ON "discovery_queue_items" USING btree ("source_id","status","priority" DESC NULLS LAST,"available_at");