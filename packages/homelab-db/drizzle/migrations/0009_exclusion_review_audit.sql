CREATE TYPE "public"."audit_actor_type" AS ENUM('human', 'openclaw', 'system');--> statement-breakpoint
CREATE TYPE "public"."exclusion_rule_scope" AS ENUM('selective_only', 'exclude_subtree');--> statement-breakpoint
CREATE TYPE "public"."review_disposition" AS ENUM('candidate', 'not_needed', 'needs_review');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"job_id" uuid,
	"queue_item_id" uuid,
	"inventory_item_id" uuid,
	"exclusion_rule_id" uuid,
	"event_type" text NOT NULL,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exclusion_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"path" text NOT NULL,
	"normalized_path" text NOT NULL,
	"scope" "exclusion_rule_scope" NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exclusion_rules_owner_path_unique" UNIQUE NULLS NOT DISTINCT("source_id","normalized_path")
);
--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "review_disposition" "review_disposition" DEFAULT 'needs_review' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "exclusion_rules" ADD CONSTRAINT "exclusion_rules_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_created_idx" ON "audit_events" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_events_source_idx" ON "audit_events" USING btree ("source_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_events_job_idx" ON "audit_events" USING btree ("job_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_events_inventory_item_idx" ON "audit_events" USING btree ("inventory_item_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_events_rule_idx" ON "audit_events" USING btree ("exclusion_rule_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "exclusion_rules_path_idx" ON "exclusion_rules" USING btree ("normalized_path");--> statement-breakpoint
CREATE INDEX "inventory_items_review_idx" ON "inventory_items" USING btree ("source_id","review_disposition");