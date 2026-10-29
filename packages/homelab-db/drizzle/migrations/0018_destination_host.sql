-- A destination now names the host that serves its export (the host's address
-- replaces settings.server). Existing destinations have no host to link, so
-- they and their jobs (which cascade to items and entries) are removed.
DELETE FROM "backup_jobs";--> statement-breakpoint
DELETE FROM "backup_destinations";--> statement-breakpoint
ALTER TABLE "backup_destinations" ADD COLUMN "host_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "backup_destinations" ADD CONSTRAINT "backup_destinations_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE restrict ON UPDATE no action;
