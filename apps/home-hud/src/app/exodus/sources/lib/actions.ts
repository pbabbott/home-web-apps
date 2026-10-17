'use server';

import { errorMessage } from './errors';
import type { BackupSource, DiscoveryJob } from './homelab-api';

const HOMELAB_API_URL = process.env.HOMELAB_API_URL ?? 'http://localhost:4003';

/**
 * Actions return a result instead of throwing: Next.js redacts the message
 * of an error thrown from a server action in production builds, and these
 * messages are meant to be shown to the user.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function post<T>(path: string, body?: unknown): Promise<ActionResult<T>> {
  try {
    const res = await fetch(`${HOMELAB_API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) return { ok: false, error: await errorMessage(res) };

    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    console.error(`POST ${path} failed:`, err);
    return { ok: false, error: 'Could not reach homelab-api' };
  }
}

export interface CreateBackupSourceInput {
  name: string;
  /** Omit for a machine that isn't a registered host. */
  hostId?: string;
}

export async function createBackupSource(
  input: CreateBackupSourceInput,
): Promise<ActionResult<BackupSource>> {
  return post<BackupSource>('/backup-sources', input);
}

export async function startDiscoveryJob(
  sourceId: string,
  rootPath: string,
): Promise<ActionResult<DiscoveryJob>> {
  return post<DiscoveryJob>(`/backup-sources/${sourceId}/discovery-jobs`, {
    rootPath,
  });
}

export async function completeDiscoveryJob(
  jobId: string,
): Promise<ActionResult<DiscoveryJob>> {
  return post<DiscoveryJob>(`/discovery-jobs/${jobId}/complete`);
}

export async function cancelDiscoveryJob(
  jobId: string,
): Promise<ActionResult<DiscoveryJob>> {
  return post<DiscoveryJob>(`/discovery-jobs/${jobId}/cancel`);
}

export async function retryQueueItem(itemId: string): Promise<ActionResult> {
  return post(`/queue-items/${itemId}/retry`);
}
