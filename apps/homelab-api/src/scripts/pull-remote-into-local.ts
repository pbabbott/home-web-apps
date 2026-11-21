import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import {
  closeDb,
  createHost,
  getHostByIpAddress,
  importAuditEvents,
  importBackupDestinations,
  importBackupEntries,
  importBackupJobItems,
  importBackupJobs,
  linkBackupJobItemCoverage,
  listInventoryKeysForImport,
  importDiscoveryJobs,
  importInventoryItems,
  importQueueItems,
  importOnDiskReviews,
  importSkipAcknowledgements,
  importSources,
  runMigrationsWithLock,
  updateHost,
  type DiscoveryJob,
  type AuditEvent,
  type BackupDestination,
  type BackupEntry,
  type BackupJob,
  type BackupJobItem,
  type ExporterType,
  type HostType,
  type InventoryItem,
  type QueueItemWithInventoryCount,
  type OnDiskReview,
  type SkipAcknowledgement,
  type Source,
} from '@abbottland/homelab-db';
import { config, initConfig } from '../config';
import { db } from '../db';
import { assertDatabaseIsLocal, initLocalDb } from './local-only';

interface RemoteHost {
  id: string;
  name: string;
  hostType: HostType;
  /** Absent when the remote predates the exporterType column. */
  exporterType?: ExporterType;
  ipAddress: string;
  instance: string | null;
  /** Absent when the remote predates the model3d column; null means no model. */
  model3d?: string | null;
}

/**
 * ONE WAY ONLY: remote -> local. Reads (GET only) from a remote homelab-api —
 * e.g. production — and overwrites the LOCAL database with it. The remote is
 * only ever a source; `assertDatabaseIsLocal` refuses to run if
 * POSTGRES_HOST is not this machine.
 *
 * Pulls the host list (physical + virtual) from the remote and upserts it into
 * the local database. Local resets lose
 * hand-registered hosts; this re-seeds them without hand-typing IPs/instances
 * again. Matches existing rows by `ipAddress` rather than `id`, since `id`
 * is a per-environment UUID that will never line up across environments.
 *
 * Also syncs the exodus discovery tables (sources, jobs, queue items,
 * inventory). Those keep the remote ids for jobs and queue items so they stay
 * linked; sources match by name and inventory by (source, path), and host
 * links are re-pointed at the local host with the same IP address.
 */
async function fetchRemoteJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `GET ${url} failed: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

const fetchRemoteHosts = (remoteUrl: string) =>
  fetchRemoteJson<RemoteHost[]>(`${remoteUrl}/hosts`);

const DEFAULT_REMOTE_URL = 'https://homelab-api.local.abbottland.io';

// The remote caps both inventory and audit-event pages at 500.
const PAGE_SIZE = 500;

// The remote's acknowledgement list is capped at 1000 and has no paging.
const ACKNOWLEDGEMENT_LIMIT = 1000;

/** Drops view-only fields the API adds on top of the table row. */
function omit<T extends object, K extends keyof T>(
  row: T,
  keys: K[],
): Omit<T, K> {
  const copy = { ...row };
  for (const key of keys) delete copy[key];

  return copy;
}

/** JSON carries timestamps as strings; the DB layer wants Dates. */
function reviveDates<T extends object>(row: T, fields: (keyof T)[]): T {
  const revived = { ...row };
  for (const field of fields) {
    const value = revived[field];
    if (typeof value === 'string') {
      revived[field] = new Date(value) as T[keyof T];
    }
  }

  return revived;
}

async function syncDiscovery(
  remoteUrl: string,
  remoteHosts: RemoteHost[],
): Promise<{
  localHostIdByRemoteId: Map<string, string>;
  localSourceIdByRemoteId: Map<string, string>;
}> {
  const localHostIdByRemoteId = new Map<string, string>();
  for (const remoteHost of remoteHosts) {
    const local = await getHostByIpAddress(db, remoteHost.ipAddress);
    if (local) localHostIdByRemoteId.set(remoteHost.id, local.id);
  }

  const remoteSources = await fetchRemoteJson<Source[]>(`${remoteUrl}/sources`);
  console.log(`Got ${remoteSources.length} source(s) from remote.`);

  const localSources = await importSources(
    db,
    remoteSources.map((source) => ({
      name: source.name,
      sourceType: source.sourceType,
      hostId: source.hostId
        ? (localHostIdByRemoteId.get(source.hostId) ?? null)
        : null,
    })),
  );
  const localSourceIdByName = new Map(localSources.map((s) => [s.name, s.id]));

  for (const remoteSource of remoteSources) {
    const sourceId = localSourceIdByName.get(remoteSource.name);
    if (!sourceId) continue;
    const base = `${remoteUrl}/sources/${remoteSource.id}`;

    const jobs = (
      await fetchRemoteJson<DiscoveryJob[]>(`${base}/discovery-jobs`)
    ).map((job) =>
      reviveDates({ ...job, sourceId }, [
        'createdAt',
        'startedAt',
        'finishedAt',
        'updatedAt',
      ]),
    );
    await importDiscoveryJobs(db, jobs);

    const queueItems = (
      await fetchRemoteJson<QueueItemWithInventoryCount[]>(
        `${base}/queue-items`,
      )
    ).map((item) =>
      // `inventoryCount` rides along but is not a column; the insert ignores it.
      reviveDates(item, [
        'availableAt',
        'leaseExpiresAt',
        'createdAt',
        'updatedAt',
        'completedAt',
      ]),
    );
    await importQueueItems(db, queueItems);

    let inventoryCount = 0;
    let after: string | undefined;
    for (;;) {
      const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (after) query.set('after', after);

      const { items: page } = await fetchRemoteJson<{
        items: InventoryItem[];
      }>(`${base}/inventory-items?${query}`);
      if (page.length === 0) break;

      await importInventoryItems(
        db,
        page.map((item) =>
          reviveDates({ ...item, sourceId }, [
            'recommendedAt',
            'decidedAt',
            'firstSeenAt',
            'lastSeenAt',
            'createdAt',
            'updatedAt',
          ]),
        ),
      );
      inventoryCount += page.length;
      after = page[page.length - 1].normalizedRootPath;
      if (page.length < PAGE_SIZE) break;
    }

    // After queue items: acknowledgements may reference one.
    const acknowledgements = (
      await fetchRemoteJson<SkipAcknowledgement[]>(
        `${base}/skip-acknowledgements?limit=${ACKNOWLEDGEMENT_LIMIT}`,
      )
    ).map((ack) => reviveDates({ ...ack, sourceId }, ['createdAt']));
    if (acknowledgements.length >= ACKNOWLEDGEMENT_LIMIT) {
      console.warn(
        `  ! ${remoteSource.name}: acknowledgements hit the ${ACKNOWLEDGEMENT_LIMIT} cap; some were not pulled`,
      );
    }
    await importSkipAcknowledgements(db, acknowledgements);

    // After queue items, like acknowledgements. A remote that predates the
    // feature answers 404, which is not worth failing the whole sync for.
    let onDiskReviews: OnDiskReview[] = [];
    try {
      onDiskReviews = (
        await fetchRemoteJson<OnDiskReview[]>(
          `${base}/on-disk-reviews?limit=${ACKNOWLEDGEMENT_LIMIT}`,
        )
      ).map((review) => reviveDates({ ...review, sourceId }, ['createdAt']));
    } catch (err) {
      console.warn(
        `  ! ${remoteSource.name}: could not pull on-disk reviews (${err instanceof Error ? err.message : err})`,
      );
    }
    if (onDiskReviews.length >= ACKNOWLEDGEMENT_LIMIT) {
      console.warn(
        `  ! ${remoteSource.name}: on-disk reviews hit the ${ACKNOWLEDGEMENT_LIMIT} cap; some were not pulled`,
      );
    }
    await importOnDiskReviews(db, onDiskReviews);

    console.log(
      `  ~ ${remoteSource.name}: ${jobs.length} job(s), ${queueItems.length} queue item(s), ${inventoryCount} inventory item(s), ${acknowledgements.length} acknowledgement(s), ${onDiskReviews.length} on-disk review(s)`,
    );
  }

  const localSourceIdByRemoteId = new Map(
    remoteSources.flatMap((source) => {
      const localId = localSourceIdByName.get(source.name);

      return localId ? [[source.id, localId] as const] : [];
    }),
  );
  let auditCount = 0;
  let before: string | undefined;
  for (;;) {
    const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (before) query.set('before', before);

    const page = await fetchRemoteJson<AuditEvent[]>(
      `${remoteUrl}/audit-events?${query}`,
    );
    if (page.length === 0) break;

    await importAuditEvents(
      db,
      page.map((event) =>
        reviveDates(
          {
            ...event,
            sourceId: event.sourceId
              ? (localSourceIdByRemoteId.get(event.sourceId) ?? null)
              : null,
          },
          ['createdAt'],
        ),
      ),
    );
    auditCount += page.length;
    before = page[page.length - 1].id;
    if (page.length < PAGE_SIZE) break;
  }
  console.log(`  ~ ${auditCount} audit event(s)`);

  return { localHostIdByRemoteId, localSourceIdByRemoteId };
}

const BACKUP_ITEM_PAGE_SIZE = 500;
const BACKUP_ENTRY_PAGE_SIZE = 1000;
const BACKUP_JOB_LIMIT = 200;

/**
 * Backup destinations, jobs, job items and entries. Run after the discovery
 * sync: jobs need the local sources, items need the local inventory.
 * Destinations match by name, jobs/items keep the remote ids, entries match by
 * (item, path). Worker leases are dropped: a local worker must not inherit
 * prod's claims.
 */
async function syncBackup(
  remoteUrl: string,
  localHostIdByRemoteId: Map<string, string>,
  localSourceIdByRemoteId: Map<string, string>,
): Promise<void> {
  const remoteDestinations = await fetchRemoteJson<
    (BackupDestination & { host?: unknown; workerStale?: boolean })[]
  >(`${remoteUrl}/backup-destinations`);
  console.log(`Got ${remoteDestinations.length} backup destination(s).`);

  const destinationRows = remoteDestinations.flatMap((remote) => {
    const destination = omit(remote, ['id', 'host', 'workerStale']);
    const hostId = localHostIdByRemoteId.get(destination.hostId);
    if (!hostId) {
      console.warn(
        `  ! destination ${destination.name}: host not found locally, skipped`,
      );

      return [];
    }

    return [
      reviveDates(
        { ...destination, hostId, claimedBy: null, claimedUntil: null },
        [
          'lastValidatedAt',
          'validationRequestedAt',
          'workerSeenAt',
          'createdAt',
          'updatedAt',
        ],
      ),
    ];
  });
  const localDestinations = await importBackupDestinations(db, destinationRows);
  const localDestinationIdByName = new Map(
    localDestinations.map((d) => [d.name, d.id]),
  );
  const localDestinationIdByRemoteId = new Map(
    remoteDestinations.flatMap((d) => {
      const localId = localDestinationIdByName.get(d.name);

      return localId ? [[d.id, localId] as const] : [];
    }),
  );

  // Jobs, newest first and capped by the API.
  const remoteJobs = await fetchRemoteJson<
    (BackupJob & { progress?: unknown; scope?: unknown })[]
  >(`${remoteUrl}/backup-jobs?limit=${BACKUP_JOB_LIMIT}`);
  if (remoteJobs.length >= BACKUP_JOB_LIMIT) {
    console.warn(
      `  ! backup jobs hit the ${BACKUP_JOB_LIMIT} cap; older jobs were not pulled`,
    );
  }

  const jobs = remoteJobs.flatMap((remoteJob) => {
    const job = omit(remoteJob, ['progress', 'scope']);
    const sourceId = localSourceIdByRemoteId.get(job.sourceId);
    const destinationId = localDestinationIdByRemoteId.get(job.destinationId);
    if (!sourceId || !destinationId) return [];

    return [
      reviveDates({ ...job, sourceId, destinationId }, [
        'stalledSince',
        'createdAt',
        'startedAt',
        'finishedAt',
        'updatedAt',
      ]),
    ];
  });
  await importBackupJobs(db, jobs);
  console.log(`  ~ ${jobs.length} backup job(s)`);

  for (const job of jobs) {
    // Local inventory ids can differ from remote ones; remap by id, then path.
    const inventory = (await listInventoryKeysForImport(db, job.sourceId)).map(
      (i) => ({ id: i.id, path: i.normalizedRootPath }),
    );
    const inventoryIds = new Set(inventory.map((i) => i.id));
    const inventoryIdByPath = new Map(inventory.map((i) => [i.path, i.id]));

    const items: BackupJobItem[] = [];
    let after: string | undefined;
    for (;;) {
      const query = new URLSearchParams({
        limit: String(BACKUP_ITEM_PAGE_SIZE),
      });
      if (after) query.set('after', after);

      const { items: page, next } = await fetchRemoteJson<{
        items: Omit<BackupJobItem, 'claimToken'>[];
        next: string | null;
      }>(`${remoteUrl}/backup-jobs/${job.id}/items?${query}`);
      for (const item of page) {
        const inventoryItemId = item.inventoryItemId
          ? inventoryIds.has(item.inventoryItemId)
            ? item.inventoryItemId
            : (inventoryIdByPath.get(item.normalizedRootPath) ?? null)
          : null;
        items.push(
          reviveDates(
            {
              ...item,
              inventoryItemId,
              // The API never returns the token; in-progress rows must have one.
              claimToken: item.status === 'in_progress' ? randomUUID() : null,
            },
            [
              'availableAt',
              'leaseExpiresAt',
              'enumeratedAt',
              'startedAt',
              'completedAt',
              'createdAt',
              'updatedAt',
            ],
          ),
        );
      }
      if (!next) break;
      after = next;
    }
    await importBackupJobItems(db, items);
    await linkBackupJobItemCoverage(db, items);

    let entryCount = 0;
    for (const item of items) {
      let afterId: number | undefined;
      for (;;) {
        const query = new URLSearchParams({
          limit: String(BACKUP_ENTRY_PAGE_SIZE),
        });
        if (afterId !== undefined) query.set('after', String(afterId));

        const { entries, next } = await fetchRemoteJson<{
          entries: BackupEntry[];
          next: number | null;
        }>(`${remoteUrl}/backup-job-items/${item.id}/entries?${query}`);
        await importBackupEntries(
          db,
          entries.map((entry) =>
            reviveDates(entry, [
              'srcCreatedAt',
              'srcModifiedAt',
              'srcAccessedAt',
              'srcChangedAt',
              'verifiedAt',
              'createdAt',
              'updatedAt',
            ]),
          ),
        );
        entryCount += entries.length;
        if (next === null) break;
        afterId = next;
      }
    }

    console.log(
      `  ~ job ${job.id.slice(0, 8)} (${job.status}): ${items.length} item(s), ${entryCount} entr${entryCount === 1 ? 'y' : 'ies'}`,
    );
  }
}

async function run() {
  dotenv.config();

  const remoteUrl = process.env.REMOTE_HOMELAB_API_URL ?? DEFAULT_REMOTE_URL;

  await initConfig();
  // Check the target before anything touches it, migrations included.
  assertDatabaseIsLocal(config.postgres);
  // A freshly reset database has no tables yet; the API normally migrates at startup.
  await runMigrationsWithLock(config.postgres);
  initLocalDb(config.postgres);

  console.log(
    `Pulling hosts FROM remote ${remoteUrl}/hosts INTO local database ...`,
  );
  const remoteHosts = await fetchRemoteHosts(remoteUrl);
  console.log(`Got ${remoteHosts.length} host(s) from remote.`);

  let created = 0;
  let updated = 0;

  for (const remoteHost of remoteHosts) {
    const existing = await getHostByIpAddress(db, remoteHost.ipAddress);

    if (!existing) {
      await createHost(db, {
        name: remoteHost.name,
        ipAddress: remoteHost.ipAddress,
        hostType: remoteHost.hostType,
        exporterType: remoteHost.exporterType,
        instance: remoteHost.instance,
        model3d: remoteHost.model3d,
      });
      created += 1;
      console.log(`  + created ${remoteHost.name} (${remoteHost.ipAddress})`);
      continue;
    }

    await updateHost(db, existing.id, {
      name: remoteHost.name,
      hostType: remoteHost.hostType,
      exporterType: remoteHost.exporterType,
      instance: remoteHost.instance,
      model3d: remoteHost.model3d,
    });
    updated += 1;
    console.log(`  ~ updated ${remoteHost.name} (${remoteHost.ipAddress})`);
  }

  console.log(`Done. Created ${created}, updated ${updated}.`);

  console.log('Syncing exodus discovery data ...');
  const { localHostIdByRemoteId, localSourceIdByRemoteId } =
    await syncDiscovery(remoteUrl, remoteHosts);
  console.log('Discovery sync done.');

  console.log('Syncing exodus backup data ...');
  await syncBackup(remoteUrl, localHostIdByRemoteId, localSourceIdByRemoteId);
  console.log('Backup sync done.');

  await closeDb(db);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
