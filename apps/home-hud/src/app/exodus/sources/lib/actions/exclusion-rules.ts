'use server';

import type { ExclusionRule, ExclusionRuleScope } from '../homelab-api';
import { type ActionResult, send, post, patch } from './request';

export interface CreateExclusionRuleInput {
  /** Omit for a global rule, which applies to every source. */
  sourceId?: string;
  path: string;
  scope: ExclusionRuleScope;
  reason?: string;
}

export async function createExclusionRule(
  input: CreateExclusionRuleInput,
): Promise<ActionResult<ExclusionRule>> {
  return post<ExclusionRule>('/exclusion-rules', input);
}

export interface UpdateExclusionRuleInput {
  scope?: ExclusionRuleScope;
  /** Null clears the reason. */
  reason?: string | null;
}

export async function updateExclusionRule(
  id: string,
  input: UpdateExclusionRuleInput,
): Promise<ActionResult<ExclusionRule>> {
  return patch<ExclusionRule>(`/exclusion-rules/${id}`, input);
}

export async function deleteExclusionRule(id: string): Promise<ActionResult> {
  return send('DELETE', `/exclusion-rules/${id}`);
}
