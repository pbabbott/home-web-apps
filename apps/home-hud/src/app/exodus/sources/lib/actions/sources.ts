'use server';

import type { Source } from '../homelab-api';
import { type ActionResult, post, patch } from './request';

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

export interface UpdateSourceInput {
  name?: string;
  /** Null unlinks the host. */
  hostId?: string | null;
}

export async function updateSource(
  id: string,
  input: UpdateSourceInput,
): Promise<ActionResult<Source>> {
  return patch<Source>(`/sources/${id}`, input);
}
