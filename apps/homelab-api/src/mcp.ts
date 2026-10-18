import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as discoveryService from './services/discovery';
import {
  claimQueueItemBodySchema,
  completeQueueItemBodySchema,
  failQueueItemBodySchema,
  heartbeatQueueItemBodySchema,
  jobIdParamsSchema,
  jobListQuerySchema,
  MAX_INVENTORY_ITEMS_PER_REQUEST,
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
    'list_discovery_jobs',
    {
      description:
        'List discovery jobs with their source. Use to find active (pending/running) jobs to resume.',
      inputSchema: jobListQuerySchema.shape,
    },
    ({ sourceId }) =>
      run('list_discovery_jobs', () => discoveryService.listAllJobs(sourceId)),
  );

  server.registerTool(
    'get_discovery_job',
    {
      description:
        'Get one discovery job, including queueCounts, to check status and progress.',
      inputSchema: { id: jobId },
    },
    ({ id }) =>
      run('get_discovery_job', () => discoveryService.getDiscoveryJob(id)),
  );

  server.registerTool(
    'claim_directory',
    {
      description:
        'Claim the next directory to explore in a job. Returns { item } with a claimToken (required by every later call on that directory), or { item: null, reason } when nothing is claimable: queue_empty means the job can be completed by a human, retry_backoff means queued directories are waiting out a retry delay, and in_progress means other workers still hold leases; for the last two, try again at retryAt. The claim is a lease; extend it with heartbeat_directory.',
      inputSchema: { jobId, ...claimQueueItemBodySchema.shape },
    },
    ({ jobId, workerId, leaseSeconds }) =>
      run('claim_directory', () =>
        discoveryService.claimQueueItem(jobId, workerId, leaseSeconds),
      ),
  );

  server.registerTool(
    'heartbeat_directory',
    {
      description:
        'Extend the lease on a claimed directory so a long-running exploration is not reclaimed by another worker.',
      inputSchema: { id: queueItemId, ...heartbeatQueueItemBodySchema.shape },
    },
    ({ id, claimToken, leaseSeconds }) =>
      run('heartbeat_directory', () =>
        discoveryService.heartbeat(id, claimToken, leaseSeconds),
      ),
  );

  server.registerTool(
    'record_discovered_items',
    {
      description: `Record files and subdirectories found inside a claimed directory in one batch. Maximum ${MAX_INVENTORY_ITEMS_PER_REQUEST} items per call; a larger batch is rejected outright, so for a bigger directory split the entries into chunks of at most ${MAX_INVENTORY_ITEMS_PER_REQUEST} and call this once per chunk (re-sending an item is safe). Paths must lie inside the claimed directory. Does not enqueue subdirectories: pass them as discoveredPaths to complete_directory.`,
      inputSchema: { id: queueItemId, ...recordInventoryItemsBodySchema.shape },
    },
    ({ id, claimToken, items }) =>
      run('record_discovered_items', async () =>
        (await discoveryService.recordInventory(id, claimToken, items)).map(
          ({ item, created }) => ({ ...item, created }),
        ),
      ),
  );

  server.registerTool(
    'complete_directory',
    {
      description:
        'Mark a claimed directory as explored. Child directories found are enqueued atomically via discoveredPaths.',
      inputSchema: { id: queueItemId, ...completeQueueItemBodySchema.shape },
    },
    ({ id, claimToken, discoveredPaths }) =>
      run('complete_directory', async () => {
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
    'fail_directory',
    {
      description:
        'Report an error exploring a claimed directory. Retryable failures are requeued behind an exponential backoff until attempts run out; retryable=false fails it permanently.',
      inputSchema: { id: queueItemId, ...failQueueItemBodySchema.shape },
    },
    ({ id, claimToken, error, retryable }) =>
      run('fail_directory', () =>
        discoveryService.failItem(id, claimToken, error, retryable),
      ),
  );

  server.registerTool(
    'skip_directory',
    {
      description:
        'Mark a claimed directory as intentionally skipped (e.g. a system directory), with a reason.',
      inputSchema: { id: queueItemId, ...skipQueueItemBodySchema.shape },
    },
    ({ id, claimToken, reason }) =>
      run('skip_directory', () =>
        discoveryService.skipItem(id, claimToken, reason),
      ),
  );

  server.registerTool(
    'retry_directory',
    {
      description:
        'Requeue a permanently failed directory for exactly one more attempt.',
      inputSchema: { id: queueItemId },
    },
    ({ id }) => run('retry_directory', () => discoveryService.retryItem(id)),
  );

  return server;
};
