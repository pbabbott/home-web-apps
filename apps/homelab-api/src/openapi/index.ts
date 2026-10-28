import { createDocument, type ZodOpenApiPathsObject } from 'zod-openapi';
import { auditEventsPaths } from './discovery/audit-events';
import { backupDestinationsPaths } from './backup/destinations';
import { exclusionRulesPaths } from './discovery/exclusion-rules';
import { discoveryJobsPaths } from './discovery/discovery-jobs';
import { queueItemsPaths } from './discovery/queue-items';
import { inventoryItemsPaths } from './discovery/inventory-items';
import { onDiskReviewsPaths } from './discovery/on-disk-reviews';
import { skipAcknowledgementsPaths } from './discovery/skip-acknowledgements';
import { sourceConnectionsPaths } from './discovery/source-connections';
import { sourcesPaths } from './discovery/sources';
import { healthPaths } from './health';
import { hostsPaths } from './hosts';
import { mapsPaths } from './maps';
import { podsPaths } from './pods';

/**
 * Gives every operation without its own tags the tag of the domain module it
 * came from, so Swagger UI groups by domain instead of one "default" list.
 */
const tagged = (
  tag: string,
  paths: ZodOpenApiPathsObject,
): ZodOpenApiPathsObject =>
  Object.fromEntries(
    Object.entries(paths).map(([path, item]) => [
      path,
      Object.fromEntries(
        Object.entries(item ?? {}).map(([method, operation]) => [
          method,
          { tags: [tag], ...operation },
        ]),
      ),
    ]),
  );

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
  tags: [
    'Sources',
    'Discovery Jobs',
    'Queue Items',
    'Inventory Items',
    'Exclusion Rules',
    'Backup Destinations',
    'Backup Jobs',
    'Backup Coverage',
    'Audit Events',
    'Hosts',
    'Maps',
    'Pods',
    'Health',
  ].map((name) => ({ name })),
  paths: {
    ...tagged('Health', healthPaths),
    ...tagged('Maps', mapsPaths),
    ...tagged('Pods', podsPaths),
    ...tagged('Sources', sourcesPaths),
    ...tagged('Sources', sourceConnectionsPaths),
    ...tagged('Discovery Jobs', discoveryJobsPaths),
    ...tagged('Queue Items', queueItemsPaths),
    ...tagged('Exclusion Rules', exclusionRulesPaths),
    ...tagged('Inventory Items', inventoryItemsPaths),
    ...tagged('Queue Items', skipAcknowledgementsPaths),
    ...tagged('Queue Items', onDiskReviewsPaths),
    ...tagged('Backup Destinations', backupDestinationsPaths),
    ...tagged('Audit Events', auditEventsPaths),
    ...tagged('Hosts', hostsPaths),
  },
});
