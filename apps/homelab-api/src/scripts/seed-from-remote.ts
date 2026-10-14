import 'reflect-metadata';
import * as dotenv from 'dotenv';
import {
  closeDb,
  createHost,
  getHostByIpAddress,
  updateHost,
  type HostType,
} from '@abbottland/homelab-db';
import { initConfig } from '../config';
import { initDb, db } from '../db';

interface RemoteHost {
  name: string;
  hostType: HostType;
  ipAddress: string;
  instance: string | null;
}

/**
 * Pulls the host list (physical + virtual) from a remote homelab-api — e.g.
 * production — and upserts it into the local database. Local resets lose
 * hand-registered hosts; this re-seeds them without hand-typing IPs/instances
 * again. Matches existing rows by `ipAddress` rather than `id`, since `id`
 * is a per-environment UUID that will never line up across environments.
 */
async function fetchRemoteHosts(remoteUrl: string): Promise<RemoteHost[]> {
  const response = await fetch(`${remoteUrl}/hosts`);

  if (!response.ok) {
    throw new Error(
      `GET ${remoteUrl}/hosts failed: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as RemoteHost[];
}

async function run() {
  dotenv.config();

  const remoteUrl = process.env.REMOTE_HOMELAB_API_URL;
  if (!remoteUrl) {
    console.error('REMOTE_HOMELAB_API_URL is required, e.g.:');
    console.error(
      '  REMOTE_HOMELAB_API_URL=https://homelab-api.abbottland.io pnpm run seed:remote',
    );
    process.exit(1);
  }

  await initConfig();
  initDb();

  console.log(`Fetching hosts from ${remoteUrl}/hosts ...`);
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
        instance: remoteHost.instance,
      });
      created += 1;
      console.log(`  + created ${remoteHost.name} (${remoteHost.ipAddress})`);
      continue;
    }

    await updateHost(db, existing.id, {
      name: remoteHost.name,
      hostType: remoteHost.hostType,
      instance: remoteHost.instance,
    });
    updated += 1;
    console.log(`  ~ updated ${remoteHost.name} (${remoteHost.ipAddress})`);
  }

  console.log(`Done. Created ${created}, updated ${updated}.`);

  await closeDb(db);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
