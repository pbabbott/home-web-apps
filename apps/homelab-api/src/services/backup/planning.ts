import {
  BackupError,
  createBackupJob,
  getBackupCoverage,
  getBackupSourceDirNames,
  getPriorVerifiedDestRelPaths,
  getSourceById,
  listBackupJobs,
  listDiscoveryJobs,
  listInventoryForBackupPlanning,
  listExclusionRules,
  type Actor,
  type BackupJob,
  type BackupJobSelection,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import type { PlanBackupJobBody } from '../../schemas/backup/jobs';
import { slugifySourceDirName } from './dest-paths';
import { requireDestination } from './destinations';
import { planBackup, type NotEligibleItem, type PlanItem } from './planner';

export type PlanWarning = {
  code:
    | 'discovery_job_active'
    | 'destination_folder_exists'
    | 'destination_folder_unknown';
  message: string;
};

export type BackupPlan = {
  sourceId: string;
  destinationId: string;
  /** The folder this source's files go under at the destination. */
  sourceDirName: string;
  selection: BackupJobSelection;
  summary: {
    toCopy: number;
    skippedAlreadyCovered: number;
    skippedRedundantNested: number;
    excluded: number;
    notEligible: number;
    /** Sum of the size estimates of items to copy. */
    estimatedBytes: number;
    /** Items to copy that have no size estimate, so `estimatedBytes` is a floor. */
    unestimatedItems: number;
  };
  warnings: PlanWarning[];
  items: PlanItem[];
  notEligible: NotEligibleItem[];
};

const toSelection = (body: PlanBackupJobBody): BackupJobSelection => ({
  inventoryItemIds: body.inventoryItemIds,
  pathPrefix: body.pathPrefix,
  kinds: body.kinds,
  skipAlreadyCovered: body.skipAlreadyCovered,
});

const ACTIVE_BACKUP_STATUSES = ['planned', 'running'] as const;

/**
 * The dry run: reads everything, writes nothing. `create` runs the same code
 * and then inserts, so the plan a person confirmed is the job they get unless
 * inventory changed in between.
 */
export async function planJob(
  sourceId: string,
  body: PlanBackupJobBody,
): Promise<BackupPlan> {
  const source = await getSourceById(db, sourceId);
  if (!source) throw new BackupError('not_found', 'source not found');

  const destination = await requireDestination(body.destinationId);
  if (!destination.enabled) {
    throw new BackupError('conflict', 'backup destination is disabled');
  }

  for (const status of ACTIVE_BACKUP_STATUSES) {
    const [active] = await listBackupJobs(db, {
      sourceId,
      destinationId: destination.id,
      status,
      limit: 1,
    });
    if (active) {
      throw new BackupError(
        'conflict',
        'this source already has an active backup job for this destination',
        { jobId: active.id },
      );
    }
  }

  const sourceDirName = await resolveSourceDirName(
    sourceId,
    source.name,
    destination.id,
  );
  const selection = toSelection(body);

  const [inventory, rules, coverage, priorDestRelPaths, discoveryJobs] =
    await Promise.all([
      listInventoryForBackupPlanning(db, sourceId),
      listExclusionRules(db, { sourceId }),
      getBackupCoverage(db, { sourceId, destinationId: destination.id }),
      getPriorVerifiedDestRelPaths(db, sourceId, destination.id),
      listDiscoveryJobs(db, sourceId),
    ]);

  const coveredIds = new Set<string>(
    coverage.items
      .filter((i) => i.bucket === 'covered' || i.bucket === 'redundant_covered')
      .map((i) => i.inventoryItemId),
  );

  const { items, notEligible } = planBackup({
    selection,
    inventory,
    rules,
    coveredIds,
    priorDestRelPaths,
  });

  if (items.length === 0) {
    throw new BackupError(
      'conflict',
      notEligible.length > 0
        ? `nothing to back up: the selection holds ${notEligible.length} item(s), none approved`
        : 'nothing to back up: the selection matches no inventory items',
      { notEligible: notEligible.slice(0, 50) },
    );
  }

  const queued = items.filter((i) => i.status === 'queued');
  const reason = (r: string) =>
    items.filter((i) => i.statusReason === r).length;

  const warnings: PlanWarning[] = [];
  if (
    discoveryJobs.some((j) => j.status === 'pending' || j.status === 'running')
  ) {
    warnings.push({
      code: 'discovery_job_active',
      message:
        'A discovery job is running for this source; inventory may still change. This job’s scope is frozen when it is created.',
    });
  }
  const folderWarning = destinationFolderWarning(
    sourceDirName,
    destination.lastValidation?.rootEntries,
    await sourceFolderIsKnown(sourceId, destination.id),
  );
  if (folderWarning) warnings.push(folderWarning);

  return {
    sourceId,
    destinationId: destination.id,
    sourceDirName,
    selection,
    summary: {
      toCopy: queued.length,
      skippedAlreadyCovered: reason('already_covered'),
      skippedRedundantNested: reason('redundant_nested'),
      excluded: items.filter((i) => i.status === 'excluded').length,
      notEligible: notEligible.length,
      estimatedBytes: queued.reduce(
        (sum, i) => sum + (i.estimatedSizeBytes ?? 0),
        0,
      ),
      unestimatedItems: queued.filter((i) => i.estimatedSizeBytes == null)
        .length,
    },
    warnings,
    items,
    notEligible,
  };
}

/** Plans and, if the plan has anything in it, creates the job with a frozen scope. */
export async function createJob(
  sourceId: string,
  body: PlanBackupJobBody,
  actor: Actor,
): Promise<BackupJob> {
  const plan = await planJob(sourceId, body);

  return createBackupJob(
    db,
    {
      sourceId,
      destinationId: plan.destinationId,
      selection: plan.selection,
      sourceDirName: plan.sourceDirName,
      items: plan.items,
      createdBy: actor.id,
    },
    actor,
  );
}

/**
 * The source reuses the folder its latest job at this destination used; a
 * first job takes a slug of the source name, refused when another source has
 * it. Exodus only ever writes inside this folder.
 */
async function resolveSourceDirName(
  sourceId: string,
  sourceName: string,
  destinationId: string,
): Promise<string> {
  const used = await getBackupSourceDirNames(db, destinationId);
  const own = used.find((u) => u.sourceId === sourceId);
  if (own) return own.sourceDirName;

  const slug = slugifySourceDirName(sourceName);
  if (used.some((u) => u.sourceDirName === slug)) {
    throw new BackupError(
      'conflict',
      `folder "${slug}" at this destination already belongs to another source; rename this source`,
    );
  }

  return slug;
}

const sourceFolderIsKnown = async (sourceId: string, destinationId: string) =>
  (await getBackupSourceDirNames(db, destinationId)).some(
    (u) => u.sourceId === sourceId,
  );

/**
 * A folder of this name that Exodus did not create is worth a look (keep-both
 * protects what is in it, but a person may not expect the overlap). The folder
 * a previous job of this source made is expected, so it does not warn.
 */
export const destinationFolderWarning = (
  sourceDirName: string,
  rootEntries: string[] | undefined,
  usedBefore: boolean,
): PlanWarning | null => {
  if (usedBefore) return null;
  if (!rootEntries) {
    return {
      code: 'destination_folder_unknown',
      message: `Whether "${sourceDirName}/" already exists at the destination is unknown: the destination has not reported its contents yet. Validate it first to find out. Existing files are never overwritten.`,
    };
  }
  if (rootEntries.includes(sourceDirName)) {
    return {
      code: 'destination_folder_exists',
      message: `"${sourceDirName}/" already exists at the destination and was not created by a backup job. Existing files are never touched; a different file at the same path is kept and the copy gets a suffixed name.`,
    };
  }

  return null;
};
