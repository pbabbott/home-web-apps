import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getDiscoveryJobOperation,
  listDiscoveryJobsOperation,
} from './controllers/discovery/discovery-jobs';
import {
  createExclusionRuleOperation,
  listExclusionRulesOperation,
} from './controllers/discovery/exclusion-rules';
import {
  listInventoryItemsOperation,
  proposeInventoryItemsOperation,
} from './controllers/discovery/inventory-items';
import { MCP_INSTRUCTIONS } from './mcp-instructions';
import {
  claimQueueItemOperation,
  completeQueueItemOperation,
  failQueueItemOperation,
  heartbeatQueueItemOperation,
  listKnownSkipsOperation,
  skipQueueItemOperation,
} from './controllers/discovery/queue-items';
import * as discoveryService from './services/discovery';
import {
  claimQueueItemBodySchema,
  completeQueueItemBodySchema,
  createExclusionRuleBodySchema,
  exclusionRuleListQuerySchema,
  failQueueItemBodySchema,
  heartbeatQueueItemBodySchema,
  jobIdParamsSchema,
  jobListQuerySchema,
  knownSkipListQuerySchema,
  proposeInventoryItemsBodySchema,
  queueItemIdParamsSchema,
  inventoryItemListQuerySchema,
  sourceIdParamsSchema,
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

const workerIdSchema = claimQueueItemBodySchema.shape.workerId
  .optional()
  .describe('Your worker id, recorded in the audit log.');

const jobId = jobIdParamsSchema.shape.id.describe('Discovery job id.');
const queueItemId = queueItemIdParamsSchema.shape.id.describe(
  'Queue item (directory) id, from claim_directory.',
);

/**
 * Builds a fresh MCP server exposing the agent-facing subset of the REST
 * routes in server.ts: the discovery work loop, proposing and listing
 * inventory items, plus listing and creating source-scoped exclusion rules.
 * Source/job creation, job lifecycle (complete, cancel, fail), global rules,
 * editing or deleting rules, approving or rejecting inventory items and the audit
 * log stay human-only REST routes. A new
 * instance is created per-request (see server.ts) since the Streamable HTTP
 * transport is mounted in stateless mode.
 */
export const createMcpServer = (): McpServer => {
  const server = new McpServer(
    { name: 'homelab-api', version: '0.1.0' },
    { instructions: MCP_INSTRUCTIONS },
  );

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
    proposeInventoryItemsOperation.mcp.name,
    {
      description: proposeInventoryItemsOperation.mcp.description,
      inputSchema: {
        id: queueItemId,
        ...proposeInventoryItemsBodySchema.shape,
      },
    },
    ({ id, claimToken, workerId, inventoryItems }) =>
      run(proposeInventoryItemsOperation.mcp.name, async () =>
        (
          await discoveryService.proposeInventoryItems(
            id,
            claimToken,
            workerId ?? null,
            inventoryItems,
          )
        ).map(({ inventoryItem, created, changed, coveredBy, covers }) => ({
          ...inventoryItem,
          created,
          changed,
          coveredBy,
          covers,
        })),
      ),
  );

  server.registerTool(
    listKnownSkipsOperation.mcp.name,
    {
      description: listKnownSkipsOperation.mcp.description,
      inputSchema: {
        sourceId: sourceIdParamsSchema.shape.id.describe('Source id.'),
        ...knownSkipListQuerySchema.shape,
      },
    },
    ({ sourceId, ...filters }) =>
      run(listKnownSkipsOperation.mcp.name, () =>
        discoveryService.listSourceKnownSkips(sourceId, filters),
      ),
  );

  server.registerTool(
    listInventoryItemsOperation.mcp.name,
    {
      description: listInventoryItemsOperation.mcp.description,
      inputSchema: {
        sourceId: sourceIdParamsSchema.shape.id.describe('Source id.'),
        ...inventoryItemListQuerySchema.shape,
      },
    },
    ({ sourceId, ...filters }) =>
      run(listInventoryItemsOperation.mcp.name, () =>
        discoveryService.listSourceInventoryItems(sourceId, filters),
      ),
  );

  server.registerTool(
    completeQueueItemOperation.mcp.name,
    {
      description: completeQueueItemOperation.mcp.description,
      inputSchema: { id: queueItemId, ...completeQueueItemBodySchema.shape },
    },
    ({ id, claimToken, discoveredPaths, summary, skipped, skippedGroups }) =>
      run(completeQueueItemOperation.mcp.name, async () => {
        const { item, children } = await discoveryService.completeItem(
          id,
          claimToken,
          discoveredPaths,
          { summary, skipped, skippedGroups },
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
    listExclusionRulesOperation.mcp.name,
    {
      description: listExclusionRulesOperation.mcp.description,
      inputSchema: {
        ...exclusionRuleListQuerySchema.shape,
        sourceId: exclusionRuleListQuerySchema.shape.sourceId
          .unwrap()
          .describe('Source whose rules (plus the global ones) to list.'),
      },
    },
    (filters) =>
      run(listExclusionRulesOperation.mcp.name, () =>
        discoveryService.listExclusionRules(filters),
      ),
  );

  server.registerTool(
    createExclusionRuleOperation.mcp.name,
    {
      description: createExclusionRuleOperation.mcp.description,
      inputSchema: {
        ...createExclusionRuleBodySchema.shape,
        // The agent may only create source-scoped rules; a global rule
        // affects every machine and is a human decision.
        sourceId: createExclusionRuleBodySchema.shape.sourceId
          .unwrap()
          .describe('Source the rule applies to.'),
        workerId: workerIdSchema,
      },
    },
    ({ workerId, ...rule }) =>
      run(createExclusionRuleOperation.mcp.name, () =>
        discoveryService.createExclusionRule(rule, {
          type: 'openclaw',
          id: workerId ?? null,
        }),
      ),
  );

  return server;
};
