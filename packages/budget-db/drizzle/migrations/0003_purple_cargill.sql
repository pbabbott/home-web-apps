CREATE TABLE "budget_filter_selection_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"job_id" uuid,
	"filter_selection_id" uuid,
	"rule_name" text NOT NULL,
	"rule_description" text NOT NULL,
	"rule_snapshot" jsonb NOT NULL,
	"plan_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"transaction_date" text NOT NULL,
	"transaction_amount" bigint NOT NULL,
	"account_name" text,
	"payee_name" text,
	"action" text NOT NULL,
	"from_value" text,
	"to_value" text,
	"status" text NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "budget_filter_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"plan_id" text NOT NULL,
	"account_id" text,
	"payee_id" text,
	"amount_min_milliunits" bigint,
	"amount_max_milliunits" bigint,
	"category_id" text,
	"auto_approve" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "budget_filter_audit_applied_at_idx" ON "budget_filter_selection_audit" USING btree ("applied_at");--> statement-breakpoint
CREATE INDEX "budget_filter_audit_transaction_idx" ON "budget_filter_selection_audit" USING btree ("plan_id","transaction_id");