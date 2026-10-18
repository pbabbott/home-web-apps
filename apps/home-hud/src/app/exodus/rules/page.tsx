import {
  getExclusionRules,
  getSources,
  type ExclusionRule,
  type Source,
} from '../sources/lib/homelab-api';
import { RulesClient } from './RulesClient';

export default async function ExodusRulesPage() {
  let sources: Source[] | null = null;
  let rules: ExclusionRule[] | null = null;

  try {
    [sources, rules] = await Promise.all([getSources(), getExclusionRules()]);
  } catch (err) {
    console.error('Failed to load exclusion rules from homelab-api:', err);
  }

  return (
    <RulesClient
      sources={sources?.map(({ id, name }) => ({ id, name })) ?? null}
      rules={rules}
    />
  );
}
