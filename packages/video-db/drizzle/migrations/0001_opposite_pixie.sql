CREATE TABLE "title_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_hash" text NOT NULL,
	"file_path" text NOT NULL,
	"timestamp_seconds" integer NOT NULL,
	"title" text,
	"screenshot_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "title_cards_file_hash_timestamp_seconds_unique" UNIQUE("file_hash","timestamp_seconds")
);
