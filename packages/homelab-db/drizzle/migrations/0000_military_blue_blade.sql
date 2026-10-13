CREATE TYPE "public"."host_type" AS ENUM('physical', 'virtual');--> statement-breakpoint
CREATE TABLE "hosts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"host_type" "host_type" DEFAULT 'physical' NOT NULL,
	"ip_address" text NOT NULL,
	"instance" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hosts_instance_unique" UNIQUE("instance")
);
