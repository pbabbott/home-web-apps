CREATE TYPE "public"."video_job_step_status" AS ENUM('in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "video_job_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"step_name" text NOT NULL,
	"status" "video_job_step_status" DEFAULT 'in_progress' NOT NULL,
	"message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "video_job_steps" ADD CONSTRAINT "video_job_steps_job_id_video_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."video_jobs"("id") ON DELETE cascade ON UPDATE no action;