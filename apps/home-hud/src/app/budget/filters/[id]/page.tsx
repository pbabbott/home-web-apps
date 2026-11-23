import { FilterEditor } from './FilterEditor';
import {
  getFilterSelection,
  getPlans,
  getYnabReference,
  type FilterSelection,
} from '../../lib/budget-api';

export default async function FilterEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
    />
  );
}
