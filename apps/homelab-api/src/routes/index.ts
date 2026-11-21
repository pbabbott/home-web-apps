import { Router } from 'express';
import { backupDestinationsRouter } from './backup/destinations';
import { backupCoverageRouter } from './backup/coverage';
import { backupItemsRouter } from './backup/items';
import { backupJobsRouter } from './backup/jobs';
import { auditEventsRouter } from './discovery/audit-events';
import { discoveryJobsRouter } from './discovery/discovery-jobs';
import { queueItemsRouter } from './discovery/queue-items';
import { inventoryItemsRouter } from './discovery/inventory-items';
import { onDiskReviewsRouter } from './discovery/on-disk-reviews';
import { skipAcknowledgementsRouter } from './discovery/skip-acknowledgements';
import { sourcesRouter } from './discovery/sources';
import { hostsRouter } from './hosts';
import { mapsRouter } from './maps';
import { mediaRouter } from './media';
import { mcpRouter } from './mcp';
import { podsRouter } from './pods';

export { MCP_ROUTE } from './mcp';

export const createRouter = (): Router => {
  const router = Router();

  router.use(
    mapsRouter,
    hostsRouter,
    mediaRouter,
    podsRouter,
    sourcesRouter,
    discoveryJobsRouter,
    queueItemsRouter,
    inventoryItemsRouter,
    skipAcknowledgementsRouter,
    onDiskReviewsRouter,
    backupDestinationsRouter,
    backupJobsRouter,
    backupItemsRouter,
    backupCoverageRouter,
    auditEventsRouter,
    mcpRouter,
  );

  return router;
};
