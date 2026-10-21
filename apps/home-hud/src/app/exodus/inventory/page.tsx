import {
  parseDecisionFilter,
  parseRecommendation,
} from '../lib/inventory-display';
import {
  getInventoryItems,
  getSources,
  type InventoryItem,
  type Source,
} from '../sources/lib/homelab-api';
import { InventoryClient } from './InventoryClient';

type PageProps = {
  searchParams: Promise<{
    source?: string;
    decision?: string;
    recommendation?: string;
    after?: string;
  }>;
};

const PAGE_SIZE = 50;

export default async function ExodusInventoryPage({ searchParams }: PageProps) {
  const query = await searchParams;

  let sources: Source[] | null = null;

  try {
    sources = await getSources();
  } catch (err) {
    console.error('Failed to load sources from homelab-api:', err);
  }

  // A missing or unknown source (a stale or hand-edited URL) falls back to the
  // first one, so the page always lands on something reviewable.
  const source =
    sources?.find((s) => s.id === query.source) ?? sources?.[0] ?? null;

  const decision = parseDecisionFilter(query.decision);
  const recommendation = parseRecommendation(query.recommendation);
  const after = query.after || undefined;

  let inventoryItems: InventoryItem[] | null = null;

  if (source) {
    try {
      inventoryItems = await getInventoryItems(source.id, {
        decision: decision === 'all' ? undefined : decision,
        recommendation,
        after,
        limit: PAGE_SIZE,
      });
    } catch (err) {
      console.error('Failed to load inventory items from homelab-api:', err);
    }
  }

  return (
    <InventoryClient
      sources={sources?.map(({ id, name }) => ({ id, name })) ?? null}
      sourceId={source?.id ?? null}
      decision={decision}
      recommendation={recommendation}
      isFirstPage={!after}
      inventoryItems={inventoryItems}
      // A full page may have more behind it; the cursor is the last row seen.
      nextCursor={
        inventoryItems && inventoryItems.length === PAGE_SIZE
          ? inventoryItems[inventoryItems.length - 1].normalizedRootPath
          : null
      }
    />
  );
}
