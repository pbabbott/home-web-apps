import { z } from 'zod';
import { BACKUP_COVERAGE_BUCKETS } from '@abbottland/homelab-db';

export const backupCoverageQuerySchema = z.object({
  destinationId: z.uuid(),
  bucket: z.enum(BACKUP_COVERAGE_BUCKETS).optional().meta({
    description:
      'Only items in this bucket. Without it the listing leaves out rejected items (counted in `counts` and `omittedRejected`).',
  }),
  format: z.enum(['json']).optional().meta({
    description:
      'json: download the full report (every item, `bucket` ignored) as a file.',
  }),
});
export type BackupCoverageQuery = z.infer<typeof backupCoverageQuerySchema>;
