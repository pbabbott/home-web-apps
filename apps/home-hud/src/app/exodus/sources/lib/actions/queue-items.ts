'use server';

import { type ActionResult, post } from './request';

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

export async function retryFailedQueueItems(
  jobId: string,
): Promise<ActionResult<{ id: string }[]>> {
  return post<{ id: string }[]>(`/discovery-jobs/${jobId}/retry-failed`);
}
