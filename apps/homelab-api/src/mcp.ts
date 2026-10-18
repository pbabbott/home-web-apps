import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getDiscoveryJobOperation,
  listDiscoveryJobsOperation,
} from './controllers/discovery/discovery-jobs';
import { recordInventoryItemsOperation } from './controllers/discovery/inventory-items';
import {
  claimQueueItemOperation,
  completeQueueItemOperation,
  failQueueItemOperation,
  heartbeatQueueItemOperation,
  retryQueueItemOperation,
  skipQueueItemOperation,
} from './controllers/discovery/queue-items';
import * as discoveryService from './services/discovery';
import {
  claimQueueItemBodySchema,
  completeQueueItemBodySchema,
  failQueueItemBodySchema,
  heartbeatQueueItemBodySchema,
  jobIdParamsSchema,
  jobListQuerySchema,
  queueItemIdParamsSchema,
  recordInventoryItemsBodySchema,
  skipQueueItemBodySchema,
} from './schemas/discovery';

const textResult = (value: unknown, isError = false) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  isError,
});

/**
 * Mirrors the controllers' error handling: a DiscoveryError (not found /
 * conflict) is reported to the agent as a tool error with its details,
 * anything else is logged and returned as a generic failure.
 */
const run = async (label: string, fn: () => Promise<unknown>) => {
  try {
    return textResult(await fn());
  } catch (err) {
    if (err instanceof discoveryService.DiscoveryError) {
      return textResult(
        { code: err.code, message: err.message, ...err.details },
        true,
      );
    }

    console.error(`mcp ${label} failed:`, err);
    return textResult({ message: 'internal server error' }, true);
  }
};

const jobId = jobIdParamsSchema.shape.id.describe('Discovery job id.');
const queueItemId = queueItemIdParamsSchema.shape.id.describe(
  'Queue item (directory) id, from claim_directory.',
);

/**
 * Builds a fresh MCP server exposing the agent-facing subset of the REST
 * routes in server.ts: the discovery work loop only. Source/job creation and
 * job lifecycle (complete, cancel, fail) stay human-only REST routes. A new
 * instance is created per-request (see server.ts) since the Streamable HTTP
 * transport is mounted in stateless mode.
 */
export const createMcpServer = (): McpServer => {
  const server = new McpServer({ name: 'homelab-api', version: '0.1.0' });

  server.registerTool(
    listDiscoveryJobsOperation.mcp.name,
    {
      description: listDiscoveryJobsOperation.mcp.description,
      inputSchema: jobListQuerySchema.shape,
    },
    ({ sourceId }) =>
      run(listDiscoveryJobsOperation.mcp.name, () =>
        discoveryService.listAllJobs(sourceId),
      ),
  );

  server.registerTool(
    getDiscoveryJobOperation.mcp.name,
    {
      description: getDiscoveryJobOperation.mcp.description,
      inputSchema: { id: jobId },
    },
    ({ id }) =>
      run(getDiscoveryJobOperation.mcp.name, () =>
        discoveryService.getDiscoveryJob(id),
      ),
  );

  server.registerTool(
    claimQueueItemOperation.mcp.name,
    {
      description: claimQueueItemOperation.mcp.description,
      inputSchema: { jobId, ...claimQueueItemBodySchema.shape },
    },
    ({ jobId, workerId, leaseSeconds }) =>
      run(claimQueueItemOperation.mcp.name, () =>
        discoveryService.claimQueueItem(jobId, workerId, leaseSeconds),
      ),
  );

  server.registerTool(
    heartbeatQueueItemOperation.mcp.name,
    {
      description: heartbeatQueueItemOperation.mcp.description,
      inputSchema: { id: queueItemId, ...heartbeatQueueItemBodySchema.shape },
    },
    ({ id, claimToken, leaseSeconds }) =>
      run(heartbeatQueueItemOperation.mcp.name, () =>
        discoveryService.heartbeat(id, claimToken, leaseSeconds),
      ),
  );

  server.registerTool(
    recordInventoryItemsOperation.mcp.name,
    {
      description: recordInventoryItemsOperation.mcp.description,
      inputSchema: { id: queueItemId, ...recordInventoryItemsBodySchema.shape },
    },
    ({ id, claimToken, items }) =>
      run(recordInventoryItemsOperation.mcp.name, async () =>
        (await discoveryService.recordInventory(id, claimToken, items)).map(
          ({ item, created }) => ({ ...item, created }),
        ),
      ),
  );

  server.registerTool(
    completeQueueItemOperation.mcp.name,
    {
      description: completeQueueItemOperation.mcp.description,
      inputSchema: { id: queueItemId, ...completeQueueItemBodySchema.shape },
    },
    ({ id, claimToken, discoveredPaths }) =>
      run(completeQueueItemOperation.mcp.name, async () => {
        const { item, children } = await discoveryService.completeItem(
          id,
          claimToken,
          discoveredPaths,
        );

        return {
          ...item,
          children: children.map((child) => ({
            ...child.item,
            created: child.created,
          })),
        };
      }),
  );

  server.registerTool(
    failQueueItemOperation.mcp.name,
    {
      description: failQueueItemOperation.mcp.description,
      inputSchema: { id: queueItemId, ...failQueueItemBodySchema.shape },
    },
    ({ id, claimToken, error, retryable }) =>
      run(failQueueItemOperation.mcp.name, () =>
        discoveryService.failItem(id, claimToken, error, retryable),
      ),
  );

  server.registerTool(
    skipQueueItemOperation.mcp.name,
    {
      description: skipQueueItemOperation.mcp.description,
      inputSchema: { id: queueItemId, ...skipQueueItemBodySchema.shape },
    },
    ({ id, claimToken, reason }) =>
      run(skipQueueItemOperation.mcp.name, () =>
        discoveryService.skipItem(id, claimToken, reason),
      ),
  );

  server.registerTool(
    retryQueueItemOperation.mcp.name,
    {
      description: retryQueueItemOperation.mcp.description,
      inputSchema: { id: queueItemId },
    },
    ({ id }) =>
      run(retryQueueItemOperation.mcp.name, () =>
        discoveryService.retryItem(id),
      ),
  );

  return server;
};
