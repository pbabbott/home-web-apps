'use server';

const BUDGET_API_URL = process.env.BUDGET_API_URL ?? 'http://localhost:4005';

export type BudgetJobRequest =
  | { operation: 'hello' }
  | { operation: 'ynab_sync'; full?: boolean };

export async function createJob(request: BudgetJobRequest): Promise<void> {
  const body =
    request.operation === 'ynab_sync' && request.full
      ? { operation: 'ynab_sync', parameters: { full: true } }
      : { operation: request.operation };

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
