CREATE TABLE "series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_name" text NOT NULL,
	"directory_name" text NOT NULL,
	"season_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_series_name_unique" UNIQUE("series_name")
);
--> statement-breakpoint
ALTER TABLE "title_cards" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "file_renames" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "title_cards" ADD CONSTRAINT "title_cards_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_renames" ADD CONSTRAINT "file_renames_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE no action ON UPDATE no action;