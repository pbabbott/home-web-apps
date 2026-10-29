import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import { isUniqueViolation } from '../../pg-errors';
import {
  backupDestinations,
  backupJobItems,
  backupJobs,
  type BackupDestination,
  type BackupDestinationSettings,
  type BackupDestinationType,
  type BackupDestinationValidation,
} from '../../schema/backup';
import { insertAuditEvent, type Actor } from '../audit';
import type { Tx } from '../shared';
import { BackupError } from './shared';

export type CreateBackupDestinationInput = {
  name: string;
  connectionType?: BackupDestinationType;
  settings: BackupDestinationSettings;
  rootDir?: string | null;
  enabled?: boolean;
};

export const createBackupDestination = async (
  db: Database,
  input: CreateBackupDestinationInput,
  actor: Actor,
): Promise<BackupDestination> =>
  db.transaction(async (tx) => {
    let row: BackupDestination;
    try {
      [row] = await tx
        .insert(backupDestinations)
        .values({
          name: input.name,
          connectionType: input.connectionType ?? 'nfs',
          settings: input.settings,
          rootDir: input.rootDir ?? null,
          enabled: input.enabled ?? true,
        })
        .returning();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new BackupError(
          'conflict',
          `backup destination named "${input.name}" already exists`,
        );
      }
      throw err;
    }

    await insertAuditEvent(tx, {
      eventType: 'backup_destination.created',
      actor,
      destinationId: row.id,
      details: {
        name: row.name,
        settings: row.settings,
        rootDir: row.rootDir,
        enabled: row.enabled,
      },
    });

    return row;
  });

export const getBackupDestination = async (
  db: Database | Tx,
  id: string,
): Promise<BackupDestination | undefined> => {
  const [row] = await db
    .select()
    .from(backupDestinations)
    .where(eq(backupDestinations.id, id));

  return row;
};

export const listBackupDestinations = async (
  db: Database,
): Promise<BackupDestination[]> =>
  db.select().from(backupDestinations).orderBy(asc(backupDestinations.name));

export type UpdateBackupDestinationInput = {
  name?: string;
  settings?: BackupDestinationSettings;
  rootDir?: string | null;
};

/**
 * Edits a destination. Where the data lives (`settings`, `rootDir`) cannot
 * change while the destination has an active job or any verified job item:
 * moving the data means a new destination. The destination row is locked so
 * a job being created concurrently cannot slip past the check.
 */
export const updateBackupDestination = async (
  db: Database,
  id: string,
  input: UpdateBackupDestinationInput,
  actor: Actor,
): Promise<BackupDestination> =>
  db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(backupDestinations)
      .where(eq(backupDestinations.id, id))
      .for('update');

    if (!current) {
      throw new BackupError('not_found', 'backup destination not found');
    }

    const changesIdentity =
      (input.settings !== undefined &&
        (input.settings.server !== current.settings.server ||
          input.settings.exportPath !== current.settings.exportPath)) ||
      (input.rootDir !== undefined && input.rootDir !== current.rootDir);

    if (changesIdentity) {
      const [inUse] = await tx
        .select({ one: sql<number>`1` })
        .from(backupJobs)
        .where(
          sql`${backupJobs.destinationId} = ${id} and (${backupJobs.status} in ('planned', 'running') or exists (select 1 from ${backupJobItems} where ${backupJobItems.jobId} = ${backupJobs.id} and ${backupJobItems.status} = 'verified'))`,
        )
        .limit(1);

      if (inUse) {
        throw new BackupError(
          'conflict',
          'the destination has an active job or verified data; create a new destination to move the data',
        );
      }
    }

    const set = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.settings !== undefined ? { settings: input.settings } : {}),
      ...(input.rootDir !== undefined ? { rootDir: input.rootDir } : {}),
    };
    if (Object.keys(set).length === 0) return current;

    let row: BackupDestination;
    try {
      [row] = await tx
        .update(backupDestinations)
        .set({ ...set, updatedAt: sql`now()` })
        .where(eq(backupDestinations.id, id))
        .returning();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new BackupError(
          'conflict',
          `backup destination named "${input.name}" already exists`,
        );
      }
      throw err;
    }

    await insertAuditEvent(tx, {
      eventType: 'backup_destination.updated',
      actor,
      destinationId: id,
      details: {
        before: {
          name: current.name,
          settings: current.settings,
          rootDir: current.rootDir,
        },
        after: { name: row.name, settings: row.settings, rootDir: row.rootDir },
      },
    });

    return row;
  });

/** Disabled destinations take no new jobs and hand out no claims. */
export const setBackupDestinationEnabled = async (
  db: Database,
  id: string,
  enabled: boolean,
  actor: Actor,
): Promise<BackupDestination> =>
  db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(backupDestinations)
      .where(eq(backupDestinations.id, id))
      .for('update');

    if (!current) {
      throw new BackupError('not_found', 'backup destination not found');
    }
    if (current.enabled === enabled) return current;

    const [row] = await tx
      .update(backupDestinations)
      .set({ enabled, updatedAt: sql`now()` })
      .where(eq(backupDestinations.id, id))
      .returning();

    await insertAuditEvent(tx, {
      eventType: enabled
        ? 'backup_destination.enabled'
        : 'backup_destination.disabled',
      actor,
      destinationId: id,
    });

    return row;
  });

/** The API cannot see the mount: it asks, and the worker validates. */
export const requestBackupDestinationValidation = async (
  db: Database,
  id: string,
): Promise<BackupDestination> => {
  const [row] = await db
    .update(backupDestinations)
    .set({ validationRequestedAt: sql`now()` })
    .where(eq(backupDestinations.id, id))
    .returning();

  if (!row) throw new BackupError('not_found', 'backup destination not found');

  return row;
};

export type RecordBackupDestinationValidationInput = {
  workerId: string;
  validation: BackupDestinationValidation;
};

/**
 * Stores the worker's validation result, sets health from it and clears the
 * pending request. A request made while the worker was validating is cleared
 * too; the worker validates again on its next poll only if asked again.
 */
export const recordBackupDestinationValidation = async (
  db: Database,
  id: string,
  input: RecordBackupDestinationValidationInput,
): Promise<BackupDestination> =>
  db.transaction(async (tx) => {
    const [row] = await tx
      .update(backupDestinations)
      .set({
        health: input.validation.ok ? 'ok' : 'unhealthy',
        lastValidatedAt: sql`now()`,
        lastValidation: input.validation,
        validationRequestedAt: null,
        workerSeenAt: sql`now()`,
      })
      .where(eq(backupDestinations.id, id))
      .returning();

    if (!row) {
      throw new BackupError('not_found', 'backup destination not found');
    }

    await insertAuditEvent(tx, {
      eventType: input.validation.ok
        ? 'backup_destination.validated'
        : 'backup_destination.unhealthy',
      actor: { type: 'system', id: input.workerId },
      destinationId: id,
      details: {
        checks: input.validation.checks,
        findings: input.validation.findings,
      },
    });

    return row;
  });

/**
 * The worker's pre-flight or I/O watchdog found the destination broken.
 * Audited only on the transition, so a poll loop that keeps finding it
 * broken does not flood the log.
 */
export const markBackupDestinationUnhealthy = async (
  db: Database,
  id: string,
  input: { workerId: string; reason: string },
): Promise<BackupDestination> =>
  db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(backupDestinations)
      .where(eq(backupDestinations.id, id))
      .for('update');

    if (!current) {
      throw new BackupError('not_found', 'backup destination not found');
    }
    if (current.health === 'unhealthy') return current;

    const [row] = await tx
      .update(backupDestinations)
      .set({ health: 'unhealthy' })
      .where(eq(backupDestinations.id, id))
      .returning();

    await insertAuditEvent(tx, {
      eventType: 'backup_destination.unhealthy',
      actor: { type: 'system', id: input.workerId },
      destinationId: id,
      details: { reason: input.reason },
    });

    return row;
  });

/** The worker's last poll, so the UI can say "no worker running". */
export const touchBackupDestinationWorker = async (
  db: Database,
  id: string,
): Promise<void> => {
  await db
    .update(backupDestinations)
    .set({ workerSeenAt: sql`now()` })
    .where(eq(backupDestinations.id, id));
};

export type BackupDestinationClaimOptions = {
  workerId: string;
  leaseSeconds: number;
  /** Serve exactly this destination (an operator's pin). */
  destinationId?: string;
  /** The NFS export mounted at the worker's path; absent for a local scratch directory. */
  mount?: { server: string; exportPath: string } | null;
};

export type BackupDestinationClaimFailure =
  /** No destination is registered at all. */
  | 'none_registered'
  /** Destinations exist, but none is the pinned one or the one this mount is the export of. */
  | 'no_match'
  /** The match is served by another live worker. */
  | 'held_by_other'
  /** Several destinations could be served and nothing says which (pin one with its id). */
  | 'ambiguous';

export type BackupDestinationClaimResult =
  | { destination: BackupDestination }
  | { reason: BackupDestinationClaimFailure };

const trimTrailingSlash = (value: string): string =>
  value.length > 1 ? value.replace(/\/+$/, '') : value;

/**
 * Which destination a worker serves, from the registered ones. Pure, so the
 * rules are unit tested without a database:
 *
 * - a pin picks that destination;
 * - otherwise a mounted export picks the destination whose `server:exportPath`
 *   is that export (the worker writes to its own mount, so it must never serve
 *   another one);
 * - otherwise (a local scratch directory) any destination can be served.
 *
 * Of the matches only one that is free (never claimed, claim expired, or already
 * this worker's) can be taken; a destination this worker already holds wins, so
 * a restart finds its own again. Several free matches are ambiguous.
 */
export const chooseBackupDestination = (
  destinations: BackupDestination[],
  options: BackupDestinationClaimOptions,
  now: Date,
): BackupDestinationClaimResult => {
  if (destinations.length === 0) return { reason: 'none_registered' };

  const matches = options.destinationId
    ? destinations.filter((d) => d.id === options.destinationId)
    : options.mount
      ? destinations.filter(
          (d) =>
            d.settings.server === options.mount?.server &&
            trimTrailingSlash(d.settings.exportPath) ===
              trimTrailingSlash(options.mount.exportPath),
        )
      : destinations;

  if (matches.length === 0) return { reason: 'no_match' };

  const mine = matches.find((d) => d.claimedBy === options.workerId);

  if (mine) return { destination: mine };

  const free = matches.filter(
    (d) => !d.claimedUntil || d.claimedUntil.getTime() <= now.getTime(),
  );

  if (free.length === 0) return { reason: 'held_by_other' };
  if (free.length > 1) return { reason: 'ambiguous' };

  return { destination: free[0] };
};

/**
 * Takes the lease on the destination this worker should serve (see
 * `chooseBackupDestination`). All destinations are locked while choosing, so
 * two workers starting together cannot take the same one.
 */
export const claimBackupDestination = async (
  db: Database,
  options: BackupDestinationClaimOptions,
): Promise<BackupDestinationClaimResult> =>
  db.transaction(async (tx) => {
    const rows = await tx
      .select({ now: sql<Date>`now()` })
      .from(sql`(select 1) as t`);
    const destinations = await tx
      .select()
      .from(backupDestinations)
      .orderBy(asc(backupDestinations.name))
      .for('update');
    const chosen = chooseBackupDestination(
      destinations,
      options,
      new Date(rows[0].now),
    );

    if (!('destination' in chosen)) return chosen;

    const [row] = await tx
      .update(backupDestinations)
      .set({
        claimedBy: options.workerId,
        claimedUntil: sql`now() + make_interval(secs => ${options.leaseSeconds})`,
        workerSeenAt: sql`now()`,
      })
      .where(eq(backupDestinations.id, chosen.destination.id))
      .returning();

    return { destination: row };
  });

/**
 * Extends this worker's lease and reports that it is alive. False means the
 * claim is gone (it expired and another worker took the destination), and the
 * worker must stop serving it.
 */
export const renewBackupDestinationClaim = async (
  db: Database,
  id: string,
  options: { workerId: string; leaseSeconds: number },
): Promise<boolean> => {
  const rows = await db
    .update(backupDestinations)
    .set({
      claimedUntil: sql`now() + make_interval(secs => ${options.leaseSeconds})`,
      workerSeenAt: sql`now()`,
    })
    .where(
      and(
        eq(backupDestinations.id, id),
        eq(backupDestinations.claimedBy, options.workerId),
      ),
    )
    .returning({ id: backupDestinations.id });

  return rows.length > 0;
};

/** On a clean shutdown: lets the next worker take the destination at once. */
export const releaseBackupDestinationClaim = async (
  db: Database,
  id: string,
  workerId: string,
): Promise<void> => {
  await db
    .update(backupDestinations)
    .set({ claimedBy: null, claimedUntil: null })
    .where(
      and(
        eq(backupDestinations.id, id),
        eq(backupDestinations.claimedBy, workerId),
      ),
    );
};
