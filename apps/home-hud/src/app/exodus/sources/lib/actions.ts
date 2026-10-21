'use server';

import { errorMessage } from './errors';
import type {
  InventoryItemDecision,
  InventoryItemWithExclusion,
  DiscoveryJob,
  ExclusionRule,
  ExclusionRuleScope,
  InventoryItem,
  Source,
} from './homelab-api';

const HOMELAB_API_URL = process.env.HOMELAB_API_URL ?? 'http://localhost:4003';

/**
 * Actions return a result instead of throwing: Next.js redacts the message
 * of an error thrown from a server action in production builds, and these
 * messages are meant to be shown to the user.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function send<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<ActionResult<T>> {
  try {
    const res = await fetch(`${HOMELAB_API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) return { ok: false, error: await errorMessage(res) };

    // 204: nothing to parse.
    if (res.status === 204) return { ok: true, data: undefined as T };

    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    console.error(`${method} ${path} failed:`, err);
    return { ok: false, error: 'Could not reach homelab-api' };
  }
}

const post = <T>(path: string, body?: unknown) => send<T>('POST', path, body);
const patch = <T>(path: string, body?: unknown) => send<T>('PATCH', path, body);

export interface CreateSourceInput {
  name: string;
  /** Omit for a machine that isn't a registered host. */
  hostId?: string;
}

export async function createSource(
  input: CreateSourceInput,
): Promise<ActionResult<Source>> {
  return post<Source>('/sources', input);
}

export async function startDiscoveryJob(
  sourceId: string,
  rootPath: string,
): Promise<ActionResult<DiscoveryJob>> {
  return post<DiscoveryJob>(`/sources/${sourceId}/discovery-jobs`, {
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

export async function failDiscoveryJob(
  jobId: string,
  error: string,
): Promise<ActionResult<DiscoveryJob>> {
  return post<DiscoveryJob>(`/discovery-jobs/${jobId}/fail`, { error });
}

export interface EnqueuedQueueItem {
  item: { id: string; path: string };
  created: boolean;
}

export async function enqueueQueueItems(
  jobId: string,
  paths: string[],
  priority?: number,
): Promise<ActionResult<EnqueuedQueueItem[]>> {
  return post<EnqueuedQueueItem[]>(`/discovery-jobs/${jobId}/queue-items`, {
    paths,
    ...(priority !== undefined ? { priority } : {}),
  });
}

export async function retryQueueItem(itemId: string): Promise<ActionResult> {
  return post(`/queue-items/${itemId}/retry`);
}

export interface CreateExclusionRuleInput {
  /** Omit for a global rule, which applies to every source. */
  sourceId?: string;
  path: string;
  scope: ExclusionRuleScope;
  reason?: string;
}

export async function createExclusionRule(
  input: CreateExclusionRuleInput,
): Promise<ActionResult<ExclusionRule>> {
  return post<ExclusionRule>('/exclusion-rules', input);
}

export interface UpdateExclusionRuleInput {
  scope?: ExclusionRuleScope;
  /** Null clears the reason. */
  reason?: string | null;
}

export async function updateExclusionRule(
  id: string,
  input: UpdateExclusionRuleInput,
): Promise<ActionResult<ExclusionRule>> {
  return patch<ExclusionRule>(`/exclusion-rules/${id}`, input);
}

export async function deleteExclusionRule(id: string): Promise<ActionResult> {
  return send('DELETE', `/exclusion-rules/${id}`);
}

/**
 * A human's decision on an inventory item. Sent as the default (human) actor:
 * the API refuses anything else. An omitted note keeps the note when the
 * decision is unchanged and clears it when it changes.
 */
export async function decideInventoryItem(
  id: string,
  decision: InventoryItemDecision,
  note?: string | null,
): Promise<ActionResult<InventoryItem>> {
  return patch<InventoryItem>(`/inventory-items/${id}/decision`, {
    decision,
    ...(note !== undefined ? { note } : {}),
  });
}

/** One inventory item with how exclusion rules treat it, for the details modal. */
export async function getInventoryItemDetail(
  id: string,
): Promise<ActionResult<InventoryItemWithExclusion>> {
  try {
    const res = await fetch(`${HOMELAB_API_URL}/inventory-items/${id}`, {
      cache: 'no-store',
    });

    if (!res.ok) return { ok: false, error: await errorMessage(res) };

    return { ok: true, data: (await res.json()) as InventoryItemWithExclusion };
  } catch (err) {
    console.error(`GET /inventory-items/${id} failed:`, err);
    return { ok: false, error: 'Could not reach homelab-api' };
  }
}
