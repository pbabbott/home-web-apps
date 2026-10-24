CREATE TYPE "public"."source_connection_type" AS ENUM('smb');--> statement-breakpoint
CREATE TABLE "source_connections" (
	"source_id" uuid PRIMARY KEY NOT NULL,
	"connection_type" "source_connection_type" NOT NULL,
	"username" text NOT NULL,
	"domain" text,
	"secret_ciphertext" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_tested_at" timestamp with time zone,
	"last_test_ok" boolean,
	"last_test_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_connections" ADD CONSTRAINT "source_connections_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;