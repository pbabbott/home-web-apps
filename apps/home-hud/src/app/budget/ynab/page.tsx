import { YnabClient } from './YnabClient';
import {
  getPlans,
  getRawResponses,
  getSyncRuns,
  getSyncState,
  type YnabPlan,
  type YnabRawResponseSummary,
  type YnabSyncRun,
  type YnabSyncState,
} from '../lib/budget-api';

export default async function YnabPage() {
  let plans: YnabPlan[] | null = null;
  let syncState: YnabSyncState[] | null = null;
  let syncRuns: YnabSyncRun[] | null = null;
  let rawResponses: YnabRawResponseSummary[] | null = null;

  try {
    plans = await getPlans();
  } catch (err) {
    console.error('Failed to load plans from budget-api:', err);
  }

  try {
    syncState = await getSyncState();
  } catch (err) {
    console.error('Failed to load sync state from budget-api:', err);
  }

  try {
    syncRuns = await getSyncRuns();
  } catch (err) {
    console.error('Failed to load sync runs from budget-api:', err);
  }

  try {
    rawResponses = await getRawResponses(200);
  } catch (err) {
    console.error('Failed to load raw responses from budget-api:', err);
  }

  return (
    <YnabClient
      plans={plans}
      syncState={syncState}
      syncRuns={syncRuns}
      rawResponses={rawResponses}
    />
  );
}
