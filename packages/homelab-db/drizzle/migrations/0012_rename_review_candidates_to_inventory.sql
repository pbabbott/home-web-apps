ALTER TYPE "public"."candidate_kind" RENAME TO "inventory_item_kind";--> statement-breakpoint
ALTER TYPE "public"."candidate_recommendation" RENAME TO "inventory_item_recommendation";--> statement-breakpoint
ALTER TYPE "public"."candidate_confidence" RENAME TO "inventory_item_confidence";--> statement-breakpoint
ALTER TYPE "public"."candidate_decision" RENAME TO "inventory_item_decision";--> statement-breakpoint
ALTER TABLE "review_candidates" RENAME TO "inventory_items";--> statement-breakpoint
ALTER TABLE "inventory_items" RENAME CONSTRAINT "review_candidates_pkey" TO "inventory_items_pkey";--> statement-breakpoint
ALTER TABLE "inventory_items" RENAME CONSTRAINT "review_candidates_source_id_sources_id_fk" TO "inventory_items_source_id_sources_id_fk";--> statement-breakpoint
ALTER TABLE "inventory_items" RENAME CONSTRAINT "review_candidates_first_job_id_discovery_jobs_id_fk" TO "inventory_items_first_job_id_discovery_jobs_id_fk";--> statement-breakpoint
ALTER TABLE "inventory_items" RENAME CONSTRAINT "review_candidates_last_job_id_discovery_jobs_id_fk" TO "inventory_items_last_job_id_discovery_jobs_id_fk";--> statement-breakpoint
ALTER TABLE "inventory_items" RENAME CONSTRAINT "review_candidates_decided_check" TO "inventory_items_decided_check";--> statement-breakpoint
ALTER INDEX "review_candidates_source_path_unique" RENAME TO "inventory_items_source_path_unique";--> statement-breakpoint
ALTER INDEX "review_candidates_decision_idx" RENAME TO "inventory_items_decision_idx";--> statement-breakpoint
ALTER INDEX "review_candidates_recommendation_idx" RENAME TO "inventory_items_recommendation_idx";--> statement-breakpoint
ALTER INDEX "review_candidates_last_job_idx" RENAME TO "inventory_items_last_job_idx";--> statement-breakpoint
ALTER TABLE "audit_events" RENAME COLUMN "review_candidate_id" TO "inventory_item_id";--> statement-breakpoint
ALTER INDEX "audit_events_review_candidate_idx" RENAME TO "audit_events_inventory_item_idx";--> statement-breakpoint
UPDATE "audit_events" SET "event_type" = replace("event_type", 'review_candidate.', 'inventory_item.') WHERE "event_type" LIKE 'review_candidate.%';
