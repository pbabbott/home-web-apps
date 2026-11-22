import { YNAB_ENDPOINTS, type YnabEndpoint } from '@abbottland/budget-db';

/** Plan-scoped endpoints that support delta requests (everything but `plans`). */
export const PLAN_ENDPOINTS = YNAB_ENDPOINTS.filter(
  (endpoint): endpoint is Exclude<YnabEndpoint, 'plans'> =>
    endpoint !== 'plans',
);

export type YnabSyncParameters = {
  /** Restrict to these plan-scoped endpoints; default is all of PLAN_ENDPOINTS. */
  endpoints?: Exclude<YnabEndpoint, 'plans'>[];
  /** Ignore stored cursors and fetch full snapshots. */
  full?: boolean;
};

export const isYnabSyncParameters = (
  value: unknown,
): value is YnabSyncParameters => {
  if (typeof value !== 'object' || value === null) return false;

  const { endpoints, full } = value as Record<string, unknown>;

  return (
    (endpoints === undefined ||
      (Array.isArray(endpoints) &&
        endpoints.every((e) =>
          (PLAN_ENDPOINTS as readonly unknown[]).includes(e),
        ))) &&
    (full === undefined || typeof full === 'boolean')
  );
};
