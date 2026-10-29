ALTER TABLE "backup_destinations" ADD COLUMN "claimed_by" text;--> statement-breakpoint
ALTER TABLE "backup_destinations" ADD COLUMN "claimed_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "backup_destinations" ADD CONSTRAINT "backup_destinations_claim_check" CHECK (("backup_destinations"."claimed_by" is null) = ("backup_destinations"."claimed_until" is null));