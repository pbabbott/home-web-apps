import 'reflect-metadata';
import * as dotenv from 'dotenv';
import {
  closeDb,
  createHost,
  getHostByIpAddress,
  importAuditEvents,
  importDiscoveryJobs,
  importExclusionRules,
  importInventoryItems,
  importQueueItems,
  importOnDiskReviews,
  importSkipAcknowledgements,
  importSources,
  runMigrationsWithLock,
  updateHost,
  type DiscoveryJob,
  type AuditEvent,
  type ExclusionRule,
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
): Promise<void> {
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
  // Rules whose source is unknown locally are dropped, not made global.
  const remoteRules = await fetchRemoteJson<ExclusionRule[]>(
    `${remoteUrl}/exclusion-rules`,
  );
  const rules = remoteRules.flatMap((rule) => {
    if (rule.sourceId === null) {
      return [reviveDates(rule, ['createdAt', 'updatedAt'])];
    }
    const sourceId = localSourceIdByRemoteId.get(rule.sourceId);

    return sourceId
      ? [reviveDates({ ...rule, sourceId }, ['createdAt', 'updatedAt'])]
      : [];
  });
  await importExclusionRules(db, rules);
  console.log(`  ~ ${rules.length} exclusion rule(s)`);

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
    });
    updated += 1;
    console.log(`  ~ updated ${remoteHost.name} (${remoteHost.ipAddress})`);
  }

  console.log(`Done. Created ${created}, updated ${updated}.`);

  console.log('Syncing exodus discovery data ...');
  await syncDiscovery(remoteUrl, remoteHosts);
  console.log('Discovery sync done.');

  await closeDb(db);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
