import {
  parseDecisionFilter,
  parseKind,
  parsePage,
  parseRecommendation,
} from '../lib/inventory-display';
import {
  getInventoryItems,
  getSources,
  type InventoryItemPage,
  type Source,
} from '../sources/lib/homelab-api';
import { InventoryClient } from './InventoryClient';

type PageProps = {
  searchParams: Promise<{
    source?: string;
    decision?: string;
    recommendation?: string;
    kind?: string;
    q?: string;
    path?: string;
    page?: string;
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
  const kind = parseKind(query.kind);
  const q = query.q?.trim().slice(0, 200) || undefined;
  const path = query.path?.trim() || undefined;
  const page = parsePage(query.page);

  let inventoryPage: InventoryItemPage | null = null;

  if (source) {
    try {
      inventoryPage = await getInventoryItems(source.id, {
        decision: decision === 'all' ? undefined : decision,
        recommendation,
        kind,
        q,
        path,
        offset: (page - 1) * PAGE_SIZE,
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
      kind={kind}
      q={q}
      path={path}
      page={page}
      pageSize={PAGE_SIZE}
      inventoryItems={inventoryPage?.items ?? null}
      total={inventoryPage?.total ?? 0}
    />
  );
}
