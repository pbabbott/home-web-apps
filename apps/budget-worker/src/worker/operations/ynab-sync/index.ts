import type { BudgetJob } from '@abbottland/budget-db';
import { getYnabSyncState, recordYnabRawResponse } from '@abbottland/budget-db';
import { YnabApiError, ynabGet } from '../../../api/ynab/ynab-client';
import { config, YNAB_PLAN_UNSET, YNAB_TOKEN_UNSET } from '../../../config';
import { db } from '../../../db';
import { JobProcessingError } from '../../job-processing-error';
import type { OperationResult } from '../operation-result';
import { isYnabSyncParameters, PLAN_ENDPOINTS } from './parameters';

/** Stop issuing requests once this many of YNAB's 200/hour are used. */
export const RATE_LIMIT_STOP_AT = 170;

/**
 * Pulls raw YNAB data into the append-only raw layer (ynab_raw_responses),
 * using delta requests so a repeat run only fetches what changed. Stops
 * cleanly (job completes, remaining work reported in the message) when the
 * hourly request budget is nearly or fully spent; the next run resumes from
 * the stored cursors.
 */
export const ynabSync = async (job: BudgetJob): Promise<OperationResult> => {
  if (!isYnabSyncParameters(job.parameters)) {
    throw new JobProcessingError('invalid ynab_sync parameters');
  }

  if (config.ynab.apiToken === YNAB_TOKEN_UNSET) {
    throw new JobProcessingError('YNAB_API_TOKEN is not configured');
  }

  if (config.ynab.planId === YNAB_PLAN_UNSET) {
    throw new JobProcessingError('YNAB_PLAN_ID is not configured');
  }

  const { endpoints = PLAN_ENDPOINTS, full = false } = job.parameters;
  const targetPlanId = config.ynab.planId;

  let requests = 0;
  let stored = 0;
  const skipped: string[] = [];
  let stopReason: string | undefined;

  const shouldStop = (used: number | undefined) => {
    if (used !== undefined && used >= RATE_LIMIT_STOP_AT) {
      stopReason = `rate limit nearly spent (${used}/200)`;
    }
    return stopReason !== undefined;
  };

  try {
    const plansResponse = await ynabGet('/plans');
    requests += 1;

    await recordYnabRawResponse(db, {
      jobId: job.id,
      endpoint: 'plans',
      httpStatus: plansResponse.status,
      payload: plansResponse.body,
    });
    stored += 1;
    shouldStop(plansResponse.rateLimit?.used);

    const planIds = (
      (plansResponse.body as { data?: { plans?: { id: string }[] } }).data
        ?.plans ?? []
    ).map((plan) => plan.id);

    if (!planIds.includes(targetPlanId)) {
      throw new JobProcessingError(
        `YNAB plan not found for this token: ${targetPlanId}`,
      );
    }

    const planId = targetPlanId;

    for (const endpoint of endpoints) {
      if (stopReason) {
        skipped.push(`${planId}/${endpoint}`);
        continue;
      }

      const state = full
        ? undefined
        : await getYnabSyncState(db, planId, endpoint);
      const lastKnowledge = state?.serverKnowledge ?? null;

      const response = await ynabGet(`/plans/${planId}/${endpoint}`, {
        lastKnowledge,
      });
      requests += 1;

      await recordYnabRawResponse(db, {
        jobId: job.id,
        planId,
        endpoint,
        requestParams:
          lastKnowledge === null
            ? {}
            : { last_knowledge_of_server: lastKnowledge },
        serverKnowledgeRequested: lastKnowledge,
        serverKnowledgeReturned: response.serverKnowledge,
        httpStatus: response.status,
        payload: response.body,
      });
      stored += 1;
      shouldStop(response.rateLimit?.used);
    }
  } catch (err) {
    if (err instanceof YnabApiError && err.isRateLimited) {
      stopReason = 'YNAB returned 429 (rate limited)';
    } else {
      throw err;
    }
  }

  const base = `Stored ${stored} raw responses in ${requests} requests`;

  if (!stopReason) return { message: `${base}.` };

  return {
    message: `${base}; stopped early: ${stopReason}. Not yet fetched: ${
      skipped.length ? skipped.join(', ') : 'remaining plans/endpoints'
    }.`,
  };
};
