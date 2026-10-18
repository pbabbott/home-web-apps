import { Router } from 'express';
import { discoveryJobsRouter } from './discovery/discovery-jobs';
import { queueItemsRouter } from './discovery/queue-items';
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
    mcpRouter,
  );

  return router;
};
