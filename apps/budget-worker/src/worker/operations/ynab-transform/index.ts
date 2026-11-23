import {
  applyYnabRawResponse,
  createBudgetJob,
  getLatestYnabPlansResponse,
  getYnabRawPayload,
  isYnabPlansCurrent,
  listPendingYnabRawResponses,
  listYnabRawPlanIds,
  resetYnabTransform,
  upsertYnabPlans,
  type BudgetJob,
} from '@abbottland/budget-db';
import { db } from '../../../db';
import { JobProcessingError } from '../../job-processing-error';
import type { OperationResult } from '../operation-result';
import { mapPlans, mappers } from './mappers';
import { isYnabTransformParameters, PLAN_ENDPOINTS } from './parameters';

/**
 * Folds raw YNAB responses into the typed tables (ynab_accounts, ...), oldest
 * first, one transaction per response together with its watermark. Makes no
 * YNAB calls, so it is safe to run any time and is idempotent: with nothing
 * new in the raw layer it changes nothing. `rebuild` replays everything from
 * raw after a mapping or schema change.
 */
export const ynabTransform = async (
  job: BudgetJob,
): Promise<OperationResult> => {
  if (!isYnabTransformParameters(job.parameters)) {
    throw new JobProcessingError('invalid ynab_transform parameters');
  }

  const { endpoints = PLAN_ENDPOINTS, rebuild = false } = job.parameters;

  let responses = 0;
  let rows = 0;

  const latestPlans = await getLatestYnabPlansResponse(db);

  // The plans response has no cursor, so check whether it was already applied.
  if (latestPlans && !(await isYnabPlansCurrent(db, latestPlans.id))) {
    const plans = mapPlans(latestPlans.payload, latestPlans.id);

    await upsertYnabPlans(db, plans);
    rows += plans.length;
  }

  for (const planId of await listYnabRawPlanIds(db)) {
    for (const endpoint of endpoints) {
      if (rebuild) await resetYnabTransform(db, planId, endpoint);

      for (const raw of await listPendingYnabRawResponses(
        db,
        planId,
        endpoint,
      )) {
        try {
          const payload = await getYnabRawPayload(db, raw.id);
          const mapped = mappers[endpoint](payload, {
            planId,
            rawResponseId: raw.id,
          });
          const written = await applyYnabRawResponse(db, {
            rawResponseId: raw.id,
            planId,
            endpoint,
            isSnapshot: raw.isSnapshot,
            rows: mapped,
          });

          rows += Object.values(written).reduce((sum, n) => sum + n, 0);
          responses += 1;
        } catch (err) {
          // The watermark did not move, so the next run retries this response.
          throw new JobProcessingError(
            `ynab_transform failed on raw response ${raw.id} (${endpoint}): ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }
  }

  // Only after new data landed: the follow-up apply finds nothing to do once
  // its own changes have flowed back, which ends the sync -> apply loop.
  if (responses > 0 && !rebuild) {
    await createBudgetJob(db, {
      operation: 'apply_filter_selections',
      parameters: {},
    });
  }

  return {
    message: `${rebuild ? 'Rebuilt: applied' : 'Applied'} ${responses} raw responses (${rows} rows written).`,
  };
};
