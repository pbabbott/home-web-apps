import { AuditClient } from './AuditClient';
import { getFilterAudit } from '../lib/budget-api';

export default async function AuditPage() {
  let entries = null;

  try {
    entries = await getFilterAudit(200);
  } catch (err) {
    console.error('Failed to load audit log from budget-api:', err);
  }

  return <AuditClient entries={entries} />;
}
