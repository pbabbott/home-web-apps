'use server';

const BUDGET_API_URL = process.env.BUDGET_API_URL ?? 'http://localhost:4005';

export type BudgetJobRequest =
  | { operation: 'hello' }
  | { operation: 'ynab_sync'; full?: boolean }
  | { operation: 'ynab_transform'; rebuild?: boolean };

const jobBody = (request: BudgetJobRequest) => {
  if (request.operation === 'ynab_sync' && request.full) {
    return { operation: 'ynab_sync', parameters: { full: true } };
  }

  if (request.operation === 'ynab_transform' && request.rebuild) {
    return { operation: 'ynab_transform', parameters: { rebuild: true } };
  }

  return { operation: request.operation };
};

export async function createJob(request: BudgetJobRequest): Promise<void> {
  const body = jobBody(request);

  const res = await fetch(`${BUDGET_API_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`budget-api POST /jobs returned ${res.status}: ${text}`);
  }
}
