import { getJson } from './http';

export type ExclusionRuleScope = 'selective_only' | 'exclude_subtree';

export interface ExclusionRule {
  id: string;
  /** Null for a global rule, which applies to every source. */
  sourceId: string | null;
  path: string;
  normalizedPath: string;
  scope: ExclusionRuleScope;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Every rule, global and per source. */
export async function getExclusionRules(): Promise<ExclusionRule[]> {
  return getJson<ExclusionRule[]>('/exclusion-rules');
}
