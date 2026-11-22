import type { YnabPlanEndpoint } from '@abbottland/budget-db';
import { PLAN_ENDPOINTS } from '../ynab-sync/parameters';

export { PLAN_ENDPOINTS };

export type YnabTransformParameters = {
  /** Restrict to these plan-scoped endpoints; default is all of PLAN_ENDPOINTS. */
  endpoints?: YnabPlanEndpoint[];
  /** Drop the typed rows for these endpoints and re-fold every raw response. */
  rebuild?: boolean;
};

export const isYnabTransformParameters = (
  value: unknown,
): value is YnabTransformParameters => {
  if (typeof value !== 'object' || value === null) return false;

  const { endpoints, rebuild } = value as Record<string, unknown>;

  return (
    (endpoints === undefined ||
      (Array.isArray(endpoints) &&
        endpoints.every((e) =>
          (PLAN_ENDPOINTS as readonly unknown[]).includes(e),
        ))) &&
    (rebuild === undefined || typeof rebuild === 'boolean')
  );
};
