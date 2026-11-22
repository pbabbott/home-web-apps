CREATE TYPE "public"."budget_job_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "budget_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation" text NOT NULL,
	"status" "budget_job_status" DEFAULT 'pending' NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"worker_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"error" text,
	"message" text
);
