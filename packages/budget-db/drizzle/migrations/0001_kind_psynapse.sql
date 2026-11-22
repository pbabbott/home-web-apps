CREATE TABLE "ynab_raw_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"plan_id" text,
	"endpoint" text NOT NULL,
	"request_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"server_knowledge_requested" bigint,
	"server_knowledge_returned" bigint,
	"http_status" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_sha256" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ynab_sync_state" (
	"plan_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"server_knowledge" bigint NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ynab_sync_state_plan_id_endpoint_pk" PRIMARY KEY("plan_id","endpoint")
);
--> statement-breakpoint
CREATE INDEX "ynab_raw_responses_plan_endpoint_fetched_idx" ON "ynab_raw_responses" USING btree ("plan_id","endpoint","fetched_at");