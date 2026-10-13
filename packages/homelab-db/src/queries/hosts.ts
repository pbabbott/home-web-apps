import { eq } from 'drizzle-orm';
import type { Database } from '../client';
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

export type CreateHostInput = Pick<
  NewHost,
  'name' | 'ipAddress' | 'hostType' | 'instance'
>;

export const createHost = async (
  db: Database,
  input: CreateHostInput,
): Promise<Host> => {
  const [row] = await db.insert(hosts).values(input).returning();

  return row;
};

export type UpdateHostInput = Partial<
  Pick<NewHost, 'name' | 'ipAddress' | 'hostType' | 'instance'>
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

export const deleteHost = async (
  db: Database,
  id: string,
): Promise<Host | undefined> => {
  const [row] = await db.delete(hosts).where(eq(hosts.id, id)).returning();

  return row;
};
