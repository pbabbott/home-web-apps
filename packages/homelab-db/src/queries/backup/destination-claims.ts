import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import { backupDestinations } from '../../schema/backup';
import { hosts } from '../../schema/hosts';
import {
  destinationServerNames,
  hostColumns,
  type BackupDestinationWithHost,
} from './destinations';

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
  | { destination: BackupDestinationWithHost }
  | { reason: BackupDestinationClaimFailure };

const trimTrailingSlash = (value: string): string =>
  value.length > 1 ? value.replace(/\/+$/, '') : value;

/**
 * Which destination a worker serves, from the registered ones. Pure, so the
 * rules are unit tested without a database:
 *
 * - a pin picks that destination;
 * - otherwise a mounted export picks the destination whose host and
 *   `exportPath` are that export (the worker writes to its own mount, so it must never serve
 *   another one);
 * - otherwise (a local scratch directory) any destination can be served.
 *
 * Of the matches only one that is free (never claimed, claim expired, or already
 * this worker's) can be taken; a destination this worker already holds wins, so
 * a restart finds its own again. Several free matches are ambiguous.
 */
export const chooseBackupDestination = (
  destinations: BackupDestinationWithHost[],
  options: BackupDestinationClaimOptions,
  now: Date,
): BackupDestinationClaimResult => {
  if (destinations.length === 0) return { reason: 'none_registered' };

  const { mount } = options;
  const matches = options.destinationId
    ? destinations.filter((d) => d.id === options.destinationId)
    : mount
      ? destinations.filter(
          (d) =>
            destinationServerNames(d.host).some(
              (name) => name.toLowerCase() === mount.server.toLowerCase(),
            ) &&
            trimTrailingSlash(d.settings.exportPath) ===
              trimTrailingSlash(mount.exportPath),
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
    const destinations = (
      await tx
        .select({ destination: backupDestinations, host: hostColumns })
        .from(backupDestinations)
        .innerJoin(hosts, eq(hosts.id, backupDestinations.hostId))
        .orderBy(asc(backupDestinations.name))
        .for('update', { of: backupDestinations })
    ).map((row) => ({ ...row.destination, host: row.host }));
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

    return { destination: { ...row, host: chosen.destination.host } };
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
