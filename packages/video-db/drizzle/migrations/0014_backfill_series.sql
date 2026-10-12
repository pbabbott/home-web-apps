-- Custom SQL migration file, put your code below! --

-- Seed the one series that existed before this concept did: the on-disk
-- directory has always been "Paw Patrol", so the directory name matches the
-- display name for this row (unlike shows added later, which may differ).
INSERT INTO "series" ("series_name", "directory_name", "season_count")
VALUES ('Paw Patrol', 'Paw Patrol', 13);
--> statement-breakpoint

-- Every title card / file rename recorded so far was produced by
-- paw_patrol_* operations, so they all belong to this one series.
UPDATE "title_cards"
SET "series_id" = (SELECT "id" FROM "series" WHERE "series_name" = 'Paw Patrol');
--> statement-breakpoint
UPDATE "file_renames"
SET "series_id" = (SELECT "id" FROM "series" WHERE "series_name" = 'Paw Patrol');
--> statement-breakpoint

ALTER TABLE "title_cards" ALTER COLUMN "series_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "file_renames" ALTER COLUMN "series_id" SET NOT NULL;
--> statement-breakpoint

-- Operations drop their paw_patrol_ prefix now that the show is a job
-- parameter rather than baked into the operation name; the two
-- season-scoped operations gain an explicit "series" parameter so existing
-- jobs keep pointing at Paw Patrol. apply_file_renames stays global/input-less
-- (it already only ever processed every pending file_renames row, not a
-- series-scoped subset), so its parameters are left untouched.
UPDATE "video_jobs"
SET
  "operation" = 'title_cards',
  "parameters" = "parameters" || '{"series": "Paw Patrol"}'::jsonb
WHERE "operation" = 'paw_patrol_title_cards';
--> statement-breakpoint
UPDATE "video_jobs"
SET
  "operation" = 'file_suggestions',
  "parameters" = "parameters" || '{"series": "Paw Patrol"}'::jsonb
WHERE "operation" = 'paw_patrol_file_suggestions';
--> statement-breakpoint
UPDATE "video_jobs"
SET "operation" = 'apply_file_renames'
WHERE "operation" = 'paw_patrol_apply_file_renames';
