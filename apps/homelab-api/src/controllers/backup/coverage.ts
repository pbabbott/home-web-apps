import * as backupService from '../../services/backup';
import { slugifySourceDirName } from '../../services/backup/dest-paths';
import { handle } from './handle';
import type { Operation } from '../operation';
import type { IdParams } from '../../schemas/backup/common';
import type { BackupCoverageQuery } from '../../schemas/backup/coverage';

// Does: say, per inventory item, whether it is backed up at a destination, and whether everything is accounted for.
// Who: human (home-hud coverage page). No MCP tool.
export const getBackupCoverageOperation = {
  summary: 'Backup coverage of a source at a destination',
  description:
    'Derived from the verified job items, never stored. Every inventory item of the source is in exactly one bucket; `allAccounted` is true only when none is in a blocking bucket (`undecided`, `pending`, `failed`, `blocked`, `never_attempted`). `rejected` means final: counted, and left out of the listing unless asked for with `bucket=rejected`. `scope` and `limits` state what the claim does and does not cover; `notes` and `discoveryReview` are display only and never change `allAccounted`. `format=json` downloads the full report (every item) as a file. Verified data is never deleted, so a later failed job does not revoke `covered`; `latestAttempt` shows the newest attempt beside it.',
  hud: '/exodus/backup/coverage',
} satisfies Operation;

export const getBackupCoverage = handle(
  'GET /sources/:id/backup-coverage',
  async (req, res) => {
    const { id } = req.params as IdParams;
    const query = req.query as unknown as BackupCoverageQuery;
    const download = query.format === 'json';
    const report = await backupService.getCoverage(id, query, download);

    if (download) {
      const day = report.generatedAt.toISOString().slice(0, 10);
      const name = [report.source.name, report.destination.name]
        .map(slugifySourceDirName)
        .join('-');
      res.attachment(`backup-coverage-${name}-${day}.json`);
      res.type('json').send(JSON.stringify(report, null, 2));

      return;
    }

    res.status(200).json(report);
  },
);
