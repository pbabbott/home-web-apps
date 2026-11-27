import { CandidatesClient } from './CandidatesClient';
import { getCandidates, getPlans, type Candidate } from '../lib/budget-api';

async function load<T>(what: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`Failed to load ${what} from budget-api:`, err);
    return null;
  }
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  // Un-approved only by default; `?unapproved=0` shows everything.
  const unapprovedOnly = query.unapproved !== '0';
  const includeCovered = query.covered === '1';
  const plans = await load('plans', getPlans);
  const planId = plans?.[0]?.id;
  const candidates: Candidate[] | null = planId
    ? await load('candidates', () =>
        getCandidates(planId, { unapprovedOnly, includeCovered }),
      )
    : null;

  return (
    <CandidatesClient
      candidates={candidates}
      unapprovedOnly={unapprovedOnly}
      includeCovered={includeCovered}
    />
  );
}
