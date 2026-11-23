import { FiltersClient } from './FiltersClient';
import {
  getFilterSelections,
  getPlans,
  getYnabReference,
  type YnabReference,
} from '../lib/budget-api';

async function load<T>(what: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`Failed to load ${what} from budget-api:`, err);
    return null;
  }
}

export default async function FiltersPage() {
  const [rules, plans] = await Promise.all([
    load('filter selections', getFilterSelections),
    load('plans', getPlans),
  ]);
  const planId = plans?.[0]?.id;
  const reference: YnabReference | null = planId
    ? await load('reference data', () => getYnabReference(planId))
    : null;

  return <FiltersClient rules={rules} reference={reference} />;
}
