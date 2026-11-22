CREATE TABLE "ynab_accounts" (
	"plan_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"on_budget" boolean NOT NULL,
	"closed" boolean NOT NULL,
	"note" text,
	"balance" bigint NOT NULL,
	"cleared_balance" bigint NOT NULL,
	"uncleared_balance" bigint NOT NULL,
	"transfer_payee_id" text,
	"direct_import_linked" boolean,
	"direct_import_in_error" boolean,
	"last_reconciled_at" timestamp with time zone,
	"deleted" boolean DEFAULT false NOT NULL,
	"last_raw_response_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ynab_accounts_plan_id_id_pk" PRIMARY KEY("plan_id","id")
);
--> statement-breakpoint
CREATE TABLE "ynab_categories" (
	"plan_id" text NOT NULL,
	"id" text NOT NULL,
	"category_group_id" text NOT NULL,
	"name" text NOT NULL,
	"hidden" boolean NOT NULL,
	"note" text,
	"budgeted" bigint NOT NULL,
	"activity" bigint NOT NULL,
	"balance" bigint NOT NULL,
	"goal_type" text,
	"goal_target" bigint,
	"goal_target_month" date,
	"goal_percentage_complete" integer,
	"goal_cadence" integer,
	"goal_cadence_frequency" integer,
	"deleted" boolean DEFAULT false NOT NULL,
	"last_raw_response_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ynab_categories_plan_id_id_pk" PRIMARY KEY("plan_id","id")
);
--> statement-breakpoint
CREATE TABLE "ynab_category_groups" (
	"plan_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"hidden" boolean NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"last_raw_response_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ynab_category_groups_plan_id_id_pk" PRIMARY KEY("plan_id","id")
);
--> statement-breakpoint
CREATE TABLE "ynab_payees" (
	"plan_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"transfer_account_id" text,
	"deleted" boolean DEFAULT false NOT NULL,
	"last_raw_response_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ynab_payees_plan_id_id_pk" PRIMARY KEY("plan_id","id")
);
--> statement-breakpoint
CREATE TABLE "ynab_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"last_modified_on" timestamp with time zone,
	"first_month" date,
	"last_month" date,
	"last_raw_response_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ynab_scheduled_subtransactions" (
	"plan_id" text NOT NULL,
	"id" text NOT NULL,
	"scheduled_transaction_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"memo" text,
	"payee_id" text,
	"category_id" text,
	"transfer_account_id" text,
	"deleted" boolean DEFAULT false NOT NULL,
	"last_raw_response_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ynab_scheduled_subtransactions_plan_id_id_pk" PRIMARY KEY("plan_id","id")
);
--> statement-breakpoint
CREATE TABLE "ynab_scheduled_transactions" (
	"plan_id" text NOT NULL,
	"id" text NOT NULL,
	"date_first" date NOT NULL,
	"date_next" date NOT NULL,
	"frequency" text NOT NULL,
	"amount" bigint NOT NULL,
	"memo" text,
	"flag_color" text,
	"flag_name" text,
	"account_id" text NOT NULL,
	"payee_id" text,
	"category_id" text,
	"transfer_account_id" text,
	"deleted" boolean DEFAULT false NOT NULL,
	"last_raw_response_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ynab_scheduled_transactions_plan_id_id_pk" PRIMARY KEY("plan_id","id")
);
--> statement-breakpoint
CREATE TABLE "ynab_subtransactions" (
	"plan_id" text NOT NULL,
	"id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"memo" text,
	"payee_id" text,
	"category_id" text,
	"transfer_account_id" text,
	"transfer_transaction_id" text,
	"deleted" boolean DEFAULT false NOT NULL,
	"last_raw_response_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ynab_subtransactions_plan_id_id_pk" PRIMARY KEY("plan_id","id")
);
--> statement-breakpoint
CREATE TABLE "ynab_transactions" (
	"plan_id" text NOT NULL,
	"id" text NOT NULL,
	"date" date NOT NULL,
	"amount" bigint NOT NULL,
	"memo" text,
	"cleared" text NOT NULL,
	"approved" boolean NOT NULL,
	"flag_color" text,
	"flag_name" text,
	"account_id" text NOT NULL,
	"payee_id" text,
	"category_id" text,
	"transfer_account_id" text,
	"transfer_transaction_id" text,
	"matched_transaction_id" text,
	"import_id" text,
	"import_payee_name" text,
	"import_payee_name_original" text,
	"debt_transaction_type" text,
	"deleted" boolean DEFAULT false NOT NULL,
	"last_raw_response_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ynab_transactions_plan_id_id_pk" PRIMARY KEY("plan_id","id")
);
--> statement-breakpoint
CREATE TABLE "ynab_month_categories" (
	"plan_id" text NOT NULL,
	"month" date NOT NULL,
	"category_id" text NOT NULL,
	"budgeted" bigint NOT NULL,
	"activity" bigint NOT NULL,
	"balance" bigint NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"last_raw_response_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ynab_month_categories_plan_id_month_category_id_pk" PRIMARY KEY("plan_id","month","category_id")
);
--> statement-breakpoint
CREATE TABLE "ynab_months" (
	"plan_id" text NOT NULL,
	"month" date NOT NULL,
	"note" text,
	"income" bigint NOT NULL,
	"budgeted" bigint NOT NULL,
	"activity" bigint NOT NULL,
	"to_be_budgeted" bigint NOT NULL,
	"age_of_money" integer,
	"deleted" boolean DEFAULT false NOT NULL,
	"last_raw_response_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ynab_months_plan_id_month_pk" PRIMARY KEY("plan_id","month")
);
--> statement-breakpoint
CREATE TABLE "ynab_transform_state" (
	"plan_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"last_raw_response_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ynab_transform_state_plan_id_endpoint_pk" PRIMARY KEY("plan_id","endpoint")
);
--> statement-breakpoint
CREATE INDEX "ynab_categories_group_idx" ON "ynab_categories" USING btree ("plan_id","category_group_id");--> statement-breakpoint
CREATE INDEX "ynab_scheduled_subtransactions_parent_idx" ON "ynab_scheduled_subtransactions" USING btree ("plan_id","scheduled_transaction_id");--> statement-breakpoint
CREATE INDEX "ynab_subtransactions_parent_idx" ON "ynab_subtransactions" USING btree ("plan_id","transaction_id");--> statement-breakpoint
CREATE INDEX "ynab_transactions_date_idx" ON "ynab_transactions" USING btree ("plan_id","date");--> statement-breakpoint
CREATE INDEX "ynab_transactions_account_idx" ON "ynab_transactions" USING btree ("plan_id","account_id");--> statement-breakpoint
CREATE INDEX "ynab_transactions_payee_idx" ON "ynab_transactions" USING btree ("plan_id","payee_id");--> statement-breakpoint
CREATE INDEX "ynab_transactions_category_idx" ON "ynab_transactions" USING btree ("plan_id","category_id");--> statement-breakpoint
CREATE VIEW "public"."ynab_transactions_enriched" AS (select "ynab_transactions"."plan_id", "ynab_transactions"."id", "ynab_transactions"."date", "ynab_transactions"."amount" / 1000.0 as "amount_units", "ynab_transactions"."memo", "ynab_transactions"."cleared", "ynab_transactions"."approved", "ynab_transactions"."account_id", "ynab_accounts"."name" as "account_name", "ynab_transactions"."payee_id", "ynab_payees"."name" as "payee_name", "ynab_transactions"."category_id", "ynab_categories"."name" as "category_name", "ynab_category_groups"."name" as "category_group_name", "ynab_transactions"."transfer_account_id" is not null as "is_transfer", exists (
        select 1 from "ynab_subtransactions"
        where "ynab_subtransactions"."plan_id" = "ynab_transactions"."plan_id"
          and "ynab_subtransactions"."transaction_id" = "ynab_transactions"."id"
          and not "ynab_subtransactions"."deleted"
      ) as "is_split" from "ynab_transactions" left join "ynab_accounts" on ("ynab_accounts"."plan_id" = "ynab_transactions"."plan_id" and "ynab_accounts"."id" = "ynab_transactions"."account_id") left join "ynab_payees" on ("ynab_payees"."plan_id" = "ynab_transactions"."plan_id" and "ynab_payees"."id" = "ynab_transactions"."payee_id") left join "ynab_categories" on ("ynab_categories"."plan_id" = "ynab_transactions"."plan_id" and "ynab_categories"."id" = "ynab_transactions"."category_id") left join "ynab_category_groups" on ("ynab_category_groups"."plan_id" = "ynab_categories"."plan_id" and "ynab_category_groups"."id" = "ynab_categories"."category_group_id") where "ynab_transactions"."deleted" = false);