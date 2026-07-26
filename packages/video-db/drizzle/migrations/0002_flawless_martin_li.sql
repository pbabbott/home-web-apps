CREATE TYPE "public"."file_rename_status" AS ENUM('pending', 'applied', 'rejected');--> statement-breakpoint
CREATE TABLE "file_renames" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_hash" text NOT NULL,
	"original_file_path" text NOT NULL,
	"suggested_file_path" text NOT NULL,
	"status" "file_rename_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone,
	CONSTRAINT "file_renames_file_hash_unique" UNIQUE("file_hash")
);
