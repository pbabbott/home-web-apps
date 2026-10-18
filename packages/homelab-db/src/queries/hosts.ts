import { eq } from 'drizzle-orm';
import type { Database } from '../client';
import { isForeignKeyViolation } from '../pg-errors';
import { hosts, type Host, type HostType, type NewHost } from '../schema/hosts';

/** All hosts, optionally filtered by physical/virtual, alphabetical by name. */
export const listHosts = async (
  db: Database,
  hostType?: HostType,
): Promise<Host[]> => {
  const query = db.select().from(hosts).orderBy(hosts.name);

  if (!hostType) return query;

  return db
    .select()
    .from(hosts)
    .where(eq(hosts.hostType, hostType))
    .orderBy(hosts.name);
};

export const getHostById = async (
  db: Database,
  id: string,
): Promise<Host | undefined> => {
  const [row] = await db.select().from(hosts).where(eq(hosts.id, id));

  return row;
};

/**
 * Lookup by `ipAddress` rather than `id` — used to match hosts across
 * environments (e.g. seeding local from remote), where `id` is a
 * per-environment UUID but `ipAddress` is the same physical/virtual host.
 * Not unique-constrained at the DB level, so this returns the first match.
 */
export const getHostByIpAddress = async (
  db: Database,
  ipAddress: string,
): Promise<Host | undefined> => {
  const [row] = await db
    .select()
    .from(hosts)
    .where(eq(hosts.ipAddress, ipAddress));

  return row;
};

export type CreateHostInput = Pick<
  NewHost,
  'name' | 'ipAddress' | 'hostType' | 'exporterType' | 'instance' | 'model3d'
>;

export const createHost = async (
  db: Database,
  input: CreateHostInput,
): Promise<Host> => {
  const [row] = await db.insert(hosts).values(input).returning();

  return row;
};

export type UpdateHostInput = Partial<
  Pick<
    NewHost,
    'name' | 'ipAddress' | 'hostType' | 'exporterType' | 'instance' | 'model3d'
  >
>;

export const updateHost = async (
  db: Database,
  id: string,
  input: UpdateHostInput,
): Promise<Host | undefined> => {
  const [row] = await db
    .update(hosts)
    .set(input)
    .where(eq(hosts.id, id))
    .returning();

  return row;
};

/** The host is still referenced (e.g. by an exodus source). */
export class HostInUseError extends Error {
  constructor() {
    super('host is still referenced by other records');
    this.name = 'HostInUseError';
  }
}

export const deleteHost = async (
  db: Database,
  id: string,
): Promise<Host | undefined> => {
  try {
    const [row] = await db.delete(hosts).where(eq(hosts.id, id)).returning();

    return row;
  } catch (err) {
    if (isForeignKeyViolation(err)) throw new HostInUseError();
    throw err;
  }
};
