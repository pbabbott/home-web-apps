import { desc, eq } from 'drizzle-orm';
import type { Database } from '../client';
import {
  budgetJobs,
  type NewBudgetJob,
  type BudgetJob,
  type BudgetJobStatus,
} from '../schema/budget-jobs';

export type CreateBudgetJobInput = Pick<
  NewBudgetJob,
  'operation' | 'parameters'
>;

export const createBudgetJob = async (
  db: Database,
  input: CreateBudgetJobInput,
): Promise<BudgetJob> => {
  const [job] = await db.insert(budgetJobs).values(input).returning();

  return job;
};

export const getBudgetJobById = async (
  db: Database,
  id: string,
): Promise<BudgetJob | undefined> => {
  const [job] = await db.select().from(budgetJobs).where(eq(budgetJobs.id, id));

  return job;
};

export type ListBudgetJobsOptions = {
  status?: BudgetJobStatus;
};

const LIST_BUDGET_JOBS_LIMIT = 100;

export const listBudgetJobs = async (
  db: Database,
  options: ListBudgetJobsOptions = {},
): Promise<BudgetJob[]> => {
  return db
    .select()
    .from(budgetJobs)
    .where(options.status ? eq(budgetJobs.status, options.status) : undefined)
    .orderBy(desc(budgetJobs.createdAt))
    .limit(LIST_BUDGET_JOBS_LIMIT);
};

/**
 * Atomically claims the oldest pending job for `workerId`. Uses
 * `FOR UPDATE SKIP LOCKED` inside a transaction so concurrent workers never
 * claim the same row: each competing transaction just skips rows already
 * locked by another claim in flight, instead of blocking on them.
 */
export const claimNextBudgetJob = async (
  db: Database,
  workerId: string,
): Promise<BudgetJob | undefined> => {
  return db.transaction(async (tx) => {
    const [next] = await tx
      .select({ id: budgetJobs.id })
      .from(budgetJobs)
      .where(eq(budgetJobs.status, 'pending'))
      .orderBy(budgetJobs.createdAt)
      .limit(1)
      .for('update', { skipLocked: true });

    if (!next) return undefined;

    const [job] = await tx
      .update(budgetJobs)
      .set({
        status: 'processing',
        workerId,
        startedAt: new Date(),
        heartbeatAt: new Date(),
      })
      .where(eq(budgetJobs.id, next.id))
      .returning();

    return job;
  });
};

export const heartbeatBudgetJob = async (
  db: Database,
  id: string,
): Promise<void> => {
  await db
    .update(budgetJobs)
    .set({ heartbeatAt: new Date() })
    .where(eq(budgetJobs.id, id));
};

export const completeBudgetJob = async (
  db: Database,
  id: string,
  message: string,
): Promise<BudgetJob> => {
  const [job] = await db
    .update(budgetJobs)
    .set({ status: 'completed', completedAt: new Date(), message })
    .where(eq(budgetJobs.id, id))
    .returning();

  return job;
};

export const failBudgetJob = async (
  db: Database,
  id: string,
  error: string,
): Promise<BudgetJob> => {
  const [job] = await db
    .update(budgetJobs)
    .set({ status: 'failed', completedAt: new Date(), error })
    .where(eq(budgetJobs.id, id))
    .returning();

  return job;
};
