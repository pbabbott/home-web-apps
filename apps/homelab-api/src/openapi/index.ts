import { createDocument } from 'zod-openapi';
import { auditEventsPaths } from './discovery/audit-events';
import { exclusionRulesPaths } from './discovery/exclusion-rules';
import { discoveryJobsPaths } from './discovery/discovery-jobs';
import { queueItemsPaths } from './discovery/queue-items';
import { inventoryItemsPaths } from './discovery/inventory-items';
import { sourcesPaths } from './discovery/sources';
import { healthPaths } from './health';
import { hostsPaths } from './hosts';
import { mapsPaths } from './maps';
import { podsPaths } from './pods';

/**
 * One module per API domain, each exporting its OpenAPI `paths`. Request
 * shapes are generated from the Zod schemas that already validate the
 * routes (src/schemas/) so they can't drift from what the API accepts;
 * response shapes are described alongside the paths that return them.
 * Operation summaries/descriptions live with the controllers.
 */
export const openApiSpec = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'homelab-api',
    version: '0.1.0',
    description:
      'Reads Kubernetes resources and enriches them with Prometheus metrics for the home-hud infra map.',
  },
  paths: {
    ...healthPaths,
    ...mapsPaths,
    ...podsPaths,
    ...sourcesPaths,
    ...discoveryJobsPaths,
    ...queueItemsPaths,
    ...exclusionRulesPaths,
    ...inventoryItemsPaths,
    ...auditEventsPaths,
    ...hostsPaths,
  },
});
