import { BudgetHomeClient } from './BudgetHomeClient';
import {
  getJobs,
  getPlans,
  getSyncRuns,
  getSyncState,
  getWorkerReady,
  type BudgetJob,
  type YnabPlan,
  type YnabSyncRun,
  type YnabSyncState,
} from './lib/budget-api';

export default async function BudgetHome() {
  let jobs: BudgetJob[] | null = null;
  let plans: YnabPlan[] | null = null;
  let syncRuns: YnabSyncRun[] | null = null;
  let syncState: YnabSyncState[] | null = null;

  try {
    jobs = await getJobs();
  } catch (err) {
    console.error('Failed to load jobs from budget-api:', err);
  }

  try {
    plans = await getPlans();
  } catch (err) {
    console.error('Failed to load plans from budget-api:', err);
  }

  try {
    syncRuns = await getSyncRuns();
  } catch (err) {
    console.error('Failed to load sync runs from budget-api:', err);
  }

  try {
    syncState = await getSyncState();
  } catch (err) {
    console.error('Failed to load sync state from budget-api:', err);
  }

  const workerReady = await getWorkerReady();

  return (
    <BudgetHomeClient
      jobs={jobs}
      plans={plans}
      syncRuns={syncRuns}
      syncState={syncState}
      workerReady={workerReady}
    />
  );
}
