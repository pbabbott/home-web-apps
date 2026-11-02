CREATE TYPE "public"."backup_destination_health" AS ENUM('unknown', 'ok', 'unhealthy');--> statement-breakpoint
CREATE TYPE "public"."backup_destination_type" AS ENUM('nfs');--> statement-breakpoint
CREATE TYPE "public"."backup_entry_issue_kind" AS ENUM('read_failed', 'unlistable', 'source_missing', 'name_too_long', 'unsupported_path', 'verify_mismatch', 'write_failed', 'dest_conflict', 'reparse_point_not_followed', 'kept_both');--> statement-breakpoint
CREATE TYPE "public"."backup_entry_status" AS ENUM('pending', 'verified', 'failed', 'not_followed');--> statement-breakpoint
CREATE TYPE "public"."backup_entry_type" AS ENUM('file', 'directory');--> statement-breakpoint
CREATE TYPE "public"."backup_job_item_status" AS ENUM('queued', 'in_progress', 'verified', 'failed', 'blocked', 'skipped', 'excluded');--> statement-breakpoint
CREATE TYPE "public"."backup_job_stalled_reason" AS ENUM('destination_unhealthy', 'destination_disabled', 'source_unreachable');--> statement-breakpoint
CREATE TYPE "public"."backup_job_status" AS ENUM('planned', 'running', 'completed', 'completed_with_issues', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "backup_destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"host_id" uuid NOT NULL,
	"connection_type" "backup_destination_type" NOT NULL,
	"settings" jsonb NOT NULL,
	"root_dir" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"health" "backup_destination_health" DEFAULT 'unknown' NOT NULL,
	"last_validated_at" timestamp with time zone,
	"last_validation" jsonb,
	"validation_requested_at" timestamp with time zone,
	"worker_seen_at" timestamp with time zone,
	"claimed_by" text,
	"claimed_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "backup_destinations_name_unique" UNIQUE("name"),
	CONSTRAINT "backup_destinations_claim_check" CHECK (("backup_destinations"."claimed_by" is null) = ("backup_destinations"."claimed_until" is null)),
	CONSTRAINT "backup_destinations_root_dir_check" CHECK ("backup_destinations"."root_dir" is null or ("backup_destinations"."root_dir" !~ '^[/\\]' and "backup_destinations"."root_dir" !~ '(^|[/\\])\.\.([/\\]|$)'))
);
--> statement-breakpoint
CREATE TABLE "backup_entries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "backup_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"job_item_id" uuid NOT NULL,
	"rel_path" text NOT NULL,
	"normalized_rel_path" text NOT NULL,
	"entry_type" "backup_entry_type" NOT NULL,
	"status" "backup_entry_status" DEFAULT 'pending' NOT NULL,
	"issue_kind" "backup_entry_issue_kind",
	"message" text,
	"size_bytes" bigint,
	"sha256" text,
	"dest_rel_path" text,
	"src_created_at" timestamp with time zone,
	"src_modified_at" timestamp with time zone,
	"src_accessed_at" timestamp with time zone,
	"src_changed_at" timestamp with time zone,
	"src_attributes" text,
	"src_streams" jsonb,
	"src_zone_identifier" text,
	"attempt" integer DEFAULT 0 NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "backup_entries_verified_check" CHECK ("backup_entries"."status" <> 'verified' or ("backup_entries"."verified_at" is not null and ("backup_entries"."entry_type" <> 'file' or ("backup_entries"."sha256" is not null and "backup_entries"."dest_rel_path" is not null)))),
	CONSTRAINT "backup_entries_failed_check" CHECK ("backup_entries"."status" <> 'failed' or "backup_entries"."issue_kind" is not null)
);
--> statement-breakpoint
CREATE TABLE "backup_job_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"inventory_item_id" uuid,
	"kind" "inventory_item_kind" NOT NULL,
	"root_path" text NOT NULL,
	"normalized_root_path" text NOT NULL,
	"dest_rel_path" text NOT NULL,
	"carve_outs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"covered_by_job_item_id" uuid,
	"estimated_size_bytes" bigint,
	"status" "backup_job_item_status" DEFAULT 'queued' NOT NULL,
	"status_reason" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_by" text,
	"last_claimed_by" text,
	"claim_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"last_error" text,
	"enumeration_complete" boolean DEFAULT false NOT NULL,
	"enumerated_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "backup_job_items_job_inventory_unique" UNIQUE("job_id","inventory_item_id"),
	CONSTRAINT "backup_job_items_attempts_check" CHECK ("backup_job_items"."attempt_count" >= 0 and "backup_job_items"."attempt_count" <= "backup_job_items"."max_attempts" and "backup_job_items"."max_attempts" > 0),
	CONSTRAINT "backup_job_items_lease_check" CHECK ("backup_job_items"."status" <> 'in_progress' or ("backup_job_items"."claimed_by" is not null and "backup_job_items"."claim_token" is not null and "backup_job_items"."lease_expires_at" is not null)),
	CONSTRAINT "backup_job_items_verified_check" CHECK ("backup_job_items"."status" <> 'verified' or ("backup_job_items"."completed_at" is not null and "backup_job_items"."enumeration_complete"))
);
--> statement-breakpoint
CREATE TABLE "backup_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"status" "backup_job_status" DEFAULT 'planned' NOT NULL,
	"stalled_reason" "backup_job_stalled_reason",
	"stalled_since" timestamp with time zone,
	"selection" jsonb NOT NULL,
	"source_dir_name" text NOT NULL,
	"error" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "backup_jobs_stalled_check" CHECK (("backup_jobs"."stalled_reason" is null) = ("backup_jobs"."stalled_since" is null)),
	CONSTRAINT "backup_jobs_finished_check" CHECK ("backup_jobs"."status" in ('planned', 'running') or "backup_jobs"."finished_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "destination_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "backup_job_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "backup_job_item_id" uuid;--> statement-breakpoint
ALTER TABLE "backup_destinations" ADD CONSTRAINT "backup_destinations_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_entries" ADD CONSTRAINT "backup_entries_job_item_id_backup_job_items_id_fk" FOREIGN KEY ("job_item_id") REFERENCES "public"."backup_job_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_job_items" ADD CONSTRAINT "backup_job_items_job_id_backup_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."backup_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_job_items" ADD CONSTRAINT "backup_job_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_job_items" ADD CONSTRAINT "backup_job_items_covered_by_fk" FOREIGN KEY ("covered_by_job_item_id") REFERENCES "public"."backup_job_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_destination_id_backup_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."backup_destinations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "backup_entries_item_path_unique" ON "backup_entries" USING btree ("job_item_id","normalized_rel_path");--> statement-breakpoint
CREATE INDEX "backup_entries_item_status_idx" ON "backup_entries" USING btree ("job_item_id","status");--> statement-breakpoint
CREATE INDEX "backup_job_items_claim_idx" ON "backup_job_items" USING btree ("job_id","status","available_at");--> statement-breakpoint
CREATE INDEX "backup_job_items_inventory_idx" ON "backup_job_items" USING btree ("inventory_item_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "backup_jobs_one_active_per_source_destination" ON "backup_jobs" USING btree ("source_id","destination_id") WHERE "backup_jobs"."status" in ('planned', 'running');--> statement-breakpoint
CREATE INDEX "backup_jobs_destination_idx" ON "backup_jobs" USING btree ("destination_id","status","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_destination_idx" ON "audit_events" USING btree ("destination_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_events_backup_job_idx" ON "audit_events" USING btree ("backup_job_id","created_at" DESC NULLS LAST);