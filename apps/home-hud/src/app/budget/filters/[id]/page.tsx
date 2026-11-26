import { FilterEditor, type RuleInitial } from './FilterEditor';
import {
  getFilterSelection,
  getPlans,
  getYnabReference,
  type FilterSelection,
  type PayeeMatchType,
} from '../../lib/budget-api';

export default async function FilterEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const one = (key: string) => {
    const v = query[key];
    return (Array.isArray(v) ? v[0] : v) || null;
  };
  const matchType = one('matchType');
  const initial: RuleInitial | null =
    id === 'new' && (one('payeeId') || one('pattern'))
      ? {
          name: one('name') ?? '',
          payeeId: one('payeeId'),
          payeeMatchType: one('pattern')
            ? ((matchType ?? 'starts_with') as PayeeMatchType)
            : null,
          payeePattern: one('pattern'),
        }
      : null;
  let rule: FilterSelection | null = null;
  let loadError: string | null = null;
  let planId: string | null = null;
  let reference = null;

  try {
    if (id !== 'new') rule = await getFilterSelection(id);

    planId = rule?.planId ?? (await getPlans())[0]?.id ?? null;
    reference = planId ? await getYnabReference(planId) : null;
  } catch (err) {
    console.error('Failed to load filter editor data:', err);
    loadError = 'Could not load data from budget-api.';
  }

  return (
    <FilterEditor
      rule={rule}
      planId={planId}
      reference={reference}
      loadError={loadError}
      initial={initial}
    />
  );
}
