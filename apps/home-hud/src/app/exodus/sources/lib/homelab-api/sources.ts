import { HOMELAB_API_URL } from './config';

export type SourceType = 'windows';

export interface Source {
  id: string;
  name: string;
  /** Joins to a registered host (`Host.id`) for the machine's name/IP; null if not linked to one. */
  hostId: string | null;
  sourceType: SourceType;
  createdAt: string;
  updatedAt: string;
}

export async function getSources(): Promise<Source[]> {
  const res = await fetch(`${HOMELAB_API_URL}/sources`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`homelab-api GET /sources returned ${res.status}: ${body}`);
  }

  return (await res.json()) as Source[];
}
