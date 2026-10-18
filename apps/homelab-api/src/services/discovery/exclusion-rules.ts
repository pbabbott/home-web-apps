import {
  DiscoveryError,
  createExclusionRule as createExclusionRuleRow,
  deleteExclusionRule as deleteExclusionRuleRow,
  getSourceById,
  listExclusionRules as listExclusionRuleRows,
  updateExclusionRule as updateExclusionRuleRow,
  type Actor,
  type ExclusionRule,
  type ExclusionRuleScope,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import { normalizeWindowsPath } from '../../lib/windows-path';

export async function listExclusionRules(filters: {
  sourceId?: string;
  scope?: ExclusionRuleScope;
}): Promise<ExclusionRule[]> {
  if (filters.sourceId && !(await getSourceById(db, filters.sourceId))) {
    throw new DiscoveryError('not_found', 'source not found');
  }

  return listExclusionRuleRows(db, filters);
}

export async function createExclusionRule(
  input: {
    sourceId: string | null;
    path: string;
    scope: ExclusionRuleScope;
    reason?: string;
  },
  actor: Actor,
): Promise<ExclusionRule> {
  const { path, normalizedPath } = normalizeWindowsPath(input.path);

  return createExclusionRuleRow(db, {
    sourceId: input.sourceId,
    path,
    normalizedPath,
    scope: input.scope,
    reason: input.reason,
    actor,
  });
}

export async function updateExclusionRule(
  id: string,
  input: { scope?: ExclusionRuleScope; reason?: string | null },
  actor: Actor,
): Promise<ExclusionRule> {
  return updateExclusionRuleRow(db, id, { ...input, actor });
}

export async function deleteExclusionRule(
  id: string,
  actor: Actor,
): Promise<void> {
  return deleteExclusionRuleRow(db, id, actor);
}
