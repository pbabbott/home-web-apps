ALTER TABLE "backup_sources" ADD COLUMN "host_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "backup_sources" ADD CONSTRAINT "backup_sources_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_sources" DROP COLUMN "hostname";