import { Router } from 'express';
import { backupDestinationsRouter } from './backup/destinations';
import { backupJobsRouter } from './backup/jobs';
import { auditEventsRouter } from './discovery/audit-events';
import { discoveryJobsRouter } from './discovery/discovery-jobs';
import { exclusionRulesRouter } from './discovery/exclusion-rules';
import { queueItemsRouter } from './discovery/queue-items';
import { inventoryItemsRouter } from './discovery/inventory-items';
import { onDiskReviewsRouter } from './discovery/on-disk-reviews';
import { skipAcknowledgementsRouter } from './discovery/skip-acknowledgements';
import { sourcesRouter } from './discovery/sources';
import { hostsRouter } from './hosts';
import { mapsRouter } from './maps';
import { mcpRouter } from './mcp';
import { podsRouter } from './pods';

export { MCP_ROUTE } from './mcp';

export const createRouter = (): Router => {
  const router = Router();

  router.use(
    mapsRouter,
    hostsRouter,
    podsRouter,
    sourcesRouter,
    discoveryJobsRouter,
    queueItemsRouter,
    exclusionRulesRouter,
    inventoryItemsRouter,
    skipAcknowledgementsRouter,
    onDiskReviewsRouter,
    backupDestinationsRouter,
    backupJobsRouter,
    auditEventsRouter,
    mcpRouter,
  );

  return router;
};
