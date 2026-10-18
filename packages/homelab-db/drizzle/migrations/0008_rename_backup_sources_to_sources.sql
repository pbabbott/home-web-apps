ALTER TYPE "public"."backup_source_type" RENAME TO "source_type";--> statement-breakpoint
ALTER TABLE "backup_sources" RENAME TO "sources";--> statement-breakpoint
ALTER TABLE "sources" RENAME CONSTRAINT "backup_sources_pkey" TO "sources_pkey";--> statement-breakpoint
ALTER TABLE "sources" RENAME CONSTRAINT "backup_sources_name_unique" TO "sources_name_unique";--> statement-breakpoint
ALTER TABLE "sources" RENAME CONSTRAINT "backup_sources_host_id_hosts_id_fk" TO "sources_host_id_hosts_id_fk";--> statement-breakpoint
ALTER TABLE "discovery_jobs" RENAME CONSTRAINT "discovery_jobs_source_id_backup_sources_id_fk" TO "discovery_jobs_source_id_sources_id_fk";--> statement-breakpoint
ALTER TABLE "inventory_items" RENAME CONSTRAINT "inventory_items_source_id_backup_sources_id_fk" TO "inventory_items_source_id_sources_id_fk";
