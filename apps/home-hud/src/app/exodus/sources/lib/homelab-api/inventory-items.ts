import { HOMELAB_API_URL } from './config';

export type InventoryItemType = 'file' | 'directory';

export type ReviewDisposition = 'candidate' | 'not_needed' | 'needs_review';

export interface InventoryItem {
  id: string;
  itemType: InventoryItemType;
  path: string;
  /** Lowercased path; the cursor for the next page. */
  normalizedPath: string;
  parentPath: string | null;
  name: string;
  extension: string | null;
  sizeBytes: number | null;
  modifiedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  /** The human's decision; separate from the filesystem facts above. */
  reviewDisposition: ReviewDisposition;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
}

export interface InventoryQuery {
  reviewDisposition?: ReviewDisposition;
  /** Only direct children of this directory. */
  parentPath?: string;
  /** Items at or beneath this path. */
  pathPrefix?: string;
  itemType?: InventoryItemType;
  /** The `normalizedPath` of the last item of the previous page. */
  after?: string;
  limit?: number;
}

/** A page of a source's inventory, ordered by normalized path. */
export async function getInventoryItems(
  sourceId: string,
  query: InventoryQuery,
): Promise<InventoryItem[]> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }

  const res = await fetch(
    `${HOMELAB_API_URL}/sources/${sourceId}/inventory-items?${params}`,
    { cache: 'no-store' },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /sources/${sourceId}/inventory-items returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as InventoryItem[];
}
