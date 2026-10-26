import { notFound } from 'next/navigation';
import {
  getInventoryItems,
  getQueueItem,
  getSources,
  type InventoryItem,
  type QueueItemDetail,
} from '../../../../sources/lib/homelab-api';
import { listInventoryPathsUnder } from '../../../../sources/lib/actions';
import { DirectoryDetailClient } from './DirectoryDetailClient';

interface DirectoryDetailPageProps {
  params: Promise<{ id: string; itemId: string }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ExodusDirectoryDetailPage({
  params,
}: DirectoryDetailPageProps) {
  const { id, itemId } = await params;

  // A hand-edited id that is not a uuid would 400 the API.
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(itemId)) notFound();

  let item: QueueItemDetail;

  try {
    item = await getQueueItem(itemId);
  } catch (err) {
    console.error('Failed to load the queue item from homelab-api:', err);
    notFound();
  }

  // The directory belongs to one job; a url naming another is a wrong link.
  if (item.jobId !== id) notFound();

  const sourceId = item.job.sourceId;
  const [inventoryResult, inventoriedResult, sourcesResult] =
    await Promise.allSettled([
      getInventoryItems(sourceId, { queueItemId: itemId, limit: 500 }),
      listInventoryPathsUnder(sourceId, item.path),
      getSources(),
    ]);

  let inventoryItems: InventoryItem[] | null = null;

  if (inventoryResult.status === 'fulfilled') {
    inventoryItems = inventoryResult.value.items;
  } else {
    console.error(
      'Failed to load inventory items from homelab-api:',
      inventoryResult.reason,
    );
  }

  const inventoriedPaths =
    inventoriedResult.status === 'fulfilled' && inventoriedResult.value.ok
      ? inventoriedResult.value.data
      : [];

  const sourceName =
    sourcesResult.status === 'fulfilled'
      ? (sourcesResult.value.find((s) => s.id === sourceId)?.name ?? null)
      : null;

  return (
    <DirectoryDetailClient
      item={item}
      sourceName={sourceName}
      inventoryItems={inventoryItems}
      inventoriedPaths={inventoriedPaths}
    />
  );
}
