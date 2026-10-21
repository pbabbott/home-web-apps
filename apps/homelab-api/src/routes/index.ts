import { Router } from 'express';
import { auditEventsRouter } from './discovery/audit-events';
import { discoveryJobsRouter } from './discovery/discovery-jobs';
import { exclusionRulesRouter } from './discovery/exclusion-rules';
import { queueItemsRouter } from './discovery/queue-items';
import { inventoryItemsRouter } from './discovery/inventory-items';
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
    auditEventsRouter,
    mcpRouter,
  );

  return router;
};
