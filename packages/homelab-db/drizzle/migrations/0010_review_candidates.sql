CREATE TYPE "public"."candidate_confidence" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."candidate_decision" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."candidate_recommendation" AS ENUM('back_up', 'skip', 'needs_review');--> statement-breakpoint
CREATE TABLE "review_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"first_job_id" uuid,
	"last_job_id" uuid,
	"kind" "inventory_item_type" NOT NULL,
	"root_path" text NOT NULL,
	"normalized_root_path" text NOT NULL,
	"display_name" text NOT NULL,
	"summary" text NOT NULL,
	"recommendation" "candidate_recommendation" NOT NULL,
	"confidence" "candidate_confidence" NOT NULL,
	"recommendation_reason" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"recommended_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recommended_by" text,
	"decision" "candidate_decision" DEFAULT 'pending' NOT NULL,
	"decision_note" text,
	"decided_at" timestamp with time zone,
	"decided_by" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_candidates_decided_check" CHECK ("review_candidates"."decision" = 'pending' or "review_candidates"."decided_at" is not null)
);
--> statement-breakpoint
-- Keep every human review decision made on inventory items: carry reviewed rows
-- over as candidates (candidate -> approved, not_needed -> rejected,
-- needs_review -> pending) before the inventory review columns are dropped.
INSERT INTO "review_candidates" ("source_id", "first_job_id", "last_job_id", "kind", "root_path", "normalized_root_path", "display_name", "summary", "recommendation", "confidence", "recommendation_reason", "evidence", "decision", "decision_note", "decided_at", "decided_by")
SELECT "source_id", "first_job_id", "last_job_id", "item_type", "path", "normalized_path", "name", 'Migrated from inventory review', 'needs_review', 'low', 'migrated from inventory review',
	'{"contentKinds":["other"],"git":null,"reproducible":"unknown","sufficientInformation":false,"observations":[],"openQuestions":["No agent assessment: this decision predates review candidates."]}'::jsonb,
	CASE "review_disposition" WHEN 'candidate' THEN 'approved'::"candidate_decision" WHEN 'not_needed' THEN 'rejected'::"candidate_decision" ELSE 'pending'::"candidate_decision" END,
	"review_note", "reviewed_at", "reviewed_by"
FROM "inventory_items"
WHERE "reviewed_at" IS NOT NULL
	AND ("review_disposition" <> 'needs_review' OR "review_note" IS NOT NULL);--> statement-breakpoint
DROP INDEX "inventory_items_review_idx";--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "review_candidate_id" uuid;--> statement-breakpoint
ALTER TABLE "discovery_queue_items" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "discovery_queue_items" ADD COLUMN "result" jsonb;--> statement-breakpoint
ALTER TABLE "review_candidates" ADD CONSTRAINT "review_candidates_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_candidates" ADD CONSTRAINT "review_candidates_first_job_id_discovery_jobs_id_fk" FOREIGN KEY ("first_job_id") REFERENCES "public"."discovery_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_candidates" ADD CONSTRAINT "review_candidates_last_job_id_discovery_jobs_id_fk" FOREIGN KEY ("last_job_id") REFERENCES "public"."discovery_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "review_candidates_source_path_unique" ON "review_candidates" USING btree ("source_id","normalized_root_path");--> statement-breakpoint
CREATE INDEX "review_candidates_decision_idx" ON "review_candidates" USING btree ("source_id","decision");--> statement-breakpoint
CREATE INDEX "review_candidates_recommendation_idx" ON "review_candidates" USING btree ("source_id","recommendation");--> statement-breakpoint
CREATE INDEX "review_candidates_last_job_idx" ON "review_candidates" USING btree ("last_job_id");--> statement-breakpoint
CREATE INDEX "audit_events_review_candidate_idx" ON "audit_events" USING btree ("review_candidate_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "inventory_items" DROP COLUMN "review_disposition";--> statement-breakpoint
ALTER TABLE "inventory_items" DROP COLUMN "reviewed_at";--> statement-breakpoint
ALTER TABLE "inventory_items" DROP COLUMN "reviewed_by";--> statement-breakpoint
ALTER TABLE "inventory_items" DROP COLUMN "review_note";--> statement-breakpoint
DROP TYPE "public"."review_disposition";