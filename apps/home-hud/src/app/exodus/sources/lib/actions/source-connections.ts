'use server';

import type {
  ShareMapping,
  SourceConnection,
  SourceConnectionType,
} from '../homelab-api';
import { type ActionResult, send, post, put } from './request';

/** The source's connection, or null when it has none yet. */
export async function getSourceConnection(
  sourceId: string,
): Promise<ActionResult<SourceConnection | null>> {
  const result = await send<SourceConnection>(
    'GET',
    `/sources/${sourceId}/connection`,
  );

  // A 404 here means "not configured", not a failure; the API's message
  // for an unknown source reads the same, and the modal only opens for real ones.
  if (!result.ok && /connection not found/.test(result.error)) {
    return { ok: true, data: null };
  }

  return result;
}

export interface SaveSourceConnectionInput {
  connectionType: SourceConnectionType;
  username: string;
  domain?: string | null;
  /** Omit to keep the stored password. */
  password?: string;
  shareMappings: ShareMapping[];
}

export async function saveSourceConnection(
  sourceId: string,
  { shareMappings, ...rest }: SaveSourceConnectionInput,
): Promise<ActionResult<SourceConnection>> {
  return put<SourceConnection>(`/sources/${sourceId}/connection`, {
    ...rest,
    settings: { shareMappings },
  });
}

export async function deleteSourceConnection(
  sourceId: string,
): Promise<ActionResult> {
  return send('DELETE', `/sources/${sourceId}/connection`);
}

export async function testSourceConnection(
  sourceId: string,
): Promise<ActionResult<SourceConnection>> {
  return post<SourceConnection>(`/sources/${sourceId}/connection/test`);
}
