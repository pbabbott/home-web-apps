import { SyncClient } from './SyncClient';
import {
  getJobs,
  getPlans,
  getRawResponses,
  getSyncRuns,
  getSyncState,
} from '../lib/budget-api';

async function load<T>(what: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`Failed to load ${what} from budget-api:`, err);
    return null;
  }
}

export default async function SyncPage() {
  const [jobs, plans, syncState, syncRuns, rawResponses] = await Promise.all([
    load('jobs', getJobs),
    load('plans', getPlans),
    load('sync state', getSyncState),
    load('sync runs', getSyncRuns),
    load('raw responses', () => getRawResponses(200)),
  ]);

  return (
    <SyncClient
      jobs={jobs}
      plans={plans}
      syncState={syncState}
      syncRuns={syncRuns}
      rawResponses={rawResponses}
    />
  );
}
