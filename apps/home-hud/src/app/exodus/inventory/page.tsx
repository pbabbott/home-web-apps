import {
  parseReview,
  tidyPath,
  type InventoryTypeFilter,
} from '../lib/inventory-display';
import {
  getSources,
  getDiscoveryJobs,
  getInventoryItems,
  type Source,
  type InventoryItem,
} from '../sources/lib/homelab-api';
import { InventoryClient } from './InventoryClient';

type PageProps = {
  searchParams: Promise<{
    source?: string;
    path?: string;
    recursive?: string;
    type?: string;
    review?: string;
    after?: string;
  }>;
};

const PAGE_SIZE = 100;

function parseType(value: string | undefined): InventoryTypeFilter | undefined {
  return value === 'file' || value === 'directory' ? value : undefined;
}

export default async function ExodusInventoryPage({ searchParams }: PageProps) {
  const query = await searchParams;

  let sources: Source[] | null = null;

  try {
    sources = await getSources();
  } catch (err) {
    console.error('Failed to load sources from homelab-api:', err);
  }

  // A missing or unknown source (a stale or hand-edited URL) falls back to the
  // first one, so the page always lands on something browsable.
  const source =
    sources?.find((candidate) => candidate.id === query.source) ??
    sources?.[0] ??
    null;

  let rootPath: string | null = null;

  if (source) {
    try {
      // Newest job first: browse from where the latest run started.
      rootPath = (await getDiscoveryJobs(source.id))[0]?.rootPath ?? null;
    } catch (err) {
      console.error('Failed to load discovery jobs from homelab-api:', err);
    }
  }

  const requestedPath = query.path?.trim();
  const currentPath = requestedPath ? tidyPath(requestedPath) : rootPath;
  const recursive = query.recursive === '1';
  const type = parseType(query.type);
  const review = parseReview(query.review);
  const after = query.after || undefined;

  let items: InventoryItem[] | null = null;
  let nextCursor: string | null = null;

  if (source && currentPath) {
    try {
      const page = await getInventoryItems(source.id, {
        ...(recursive
          ? { pathPrefix: currentPath }
          : { parentPath: currentPath }),
        itemType: type,
        reviewDisposition: review,
        after,
        limit: PAGE_SIZE,
      });

      // A full page may have more behind it; the cursor is the last row seen.
      nextCursor =
        page.length === PAGE_SIZE ? page[page.length - 1].normalizedPath : null;

      // A prefix match includes the folder itself, which isn't one of its contents.
      items = recursive
        ? page.filter(
            (item) =>
              tidyPath(item.path).toLowerCase() !== currentPath.toLowerCase(),
          )
        : page;
    } catch (err) {
      console.error('Failed to load inventory from homelab-api:', err);
    }
  }

  return (
    <InventoryClient
      sources={sources?.map(({ id, name }) => ({ id, name })) ?? null}
      sourceId={source?.id ?? null}
      rootPath={rootPath}
      currentPath={currentPath}
      recursive={recursive}
      type={type}
      review={review}
      isFirstPage={!after}
      items={items}
      nextCursor={nextCursor}
    />
  );
}
