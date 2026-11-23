import { AuditClient } from './AuditClient';
import { getFilterAudit, getFilterSelections } from '../lib/budget-api';

export default async function AuditPage() {
  let entries = null;

  try {
    entries = await getFilterAudit(200);
  } catch (err) {
    console.error('Failed to load audit log from budget-api:', err);
  }

  // Used only to decide which audit rows can link to a rule that still exists.
  let ruleIds: string[] | null = null;

  try {
    ruleIds = (await getFilterSelections()).map((rule) => rule.id);
  } catch (err) {
    console.error('Failed to load filter rules from budget-api:', err);
  }

  return <AuditClient entries={entries} ruleIds={ruleIds} />;
}
