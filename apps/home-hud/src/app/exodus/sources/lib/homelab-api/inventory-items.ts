import { HOMELAB_API_URL } from './config';

export type InventoryItemKind = 'file' | 'directory';
export type InventoryItemRecommendation = 'back_up' | 'skip' | 'needs_review';
export type InventoryItemConfidence = 'low' | 'medium' | 'high';
export type InventoryItemDecision = 'pending' | 'approved' | 'rejected';

export interface InventoryItemGitEvidence {
  remoteUrl: string | null;
  remoteVisibility: 'public' | 'private' | 'none' | 'unknown';
  localStateKnown: boolean;
  uncommittedChanges: boolean | null;
  untrackedFiles: boolean | null;
  unpushedCommits: boolean | null;
  ignoredFilesOfNote: boolean | null;
}

export interface InventoryItemEvidence {
  contentKinds: string[];
  /** Null when the path is not a git repository (or was not checked). */
  git: InventoryItemGitEvidence | null;
  reproducible: 'yes' | 'no' | 'unknown';
  sufficientInformation: boolean;
  observations: string[];
  openQuestions: string[];
  estimatedSizeBytes?: number;
  estimatedFileCount?: number;
}

export interface InventoryItem {
  id: string;
  sourceId: string;
  kind: InventoryItemKind;
  rootPath: string;
  /** Lowercased path; the cursor for the next page. */
  normalizedRootPath: string;
  displayName: string;
  summary: string;
  /** The agent's view. Never an approval. */
  recommendation: InventoryItemRecommendation;
  confidence: InventoryItemConfidence;
  recommendationReason: string;
  evidence: InventoryItemEvidence;
  recommendedAt: string;
  recommendedBy: string | null;
  /** The human's call; separate from the recommendation above. */
  decision: InventoryItemDecision;
  decisionNote: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export type ExclusionState = 'none' | 'selective' | 'excluded';

/** An inventory item plus how exclusion rules currently treat its path. */
export interface InventoryItemWithExclusion extends InventoryItem {
  exclusion: { state: ExclusionState; ruleIds: string[] };
}

export interface InventoryItemQuery {
  recommendation?: InventoryItemRecommendation;
  decision?: InventoryItemDecision;
  /** Only inventory items at or beneath this path. */
  pathPrefix?: string;
  /** The `normalizedRootPath` of the last inventory item of the previous page. */
  after?: string;
  limit?: number;
}

/** A page of a source's inventory items, ordered by normalized path. */
export async function getInventoryItems(
  sourceId: string,
  query: InventoryItemQuery,
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
