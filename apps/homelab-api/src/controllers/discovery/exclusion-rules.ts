import * as discoveryService from '../../services/discovery';
import { actorOf } from '../../lib/actor';
import { handle } from './handle';
import type { Operation } from '../operation';
import type {
  CreateExclusionRuleBody,
  ExclusionRuleIdParams,
  ExclusionRuleListQuery,
  UpdateExclusionRuleBody,
} from '../../schemas/discovery';

// Does: list exclusion rules, optionally for one source (plus global rules).
// Who: human (home-hud) | agent (list_exclusion_rules), to see what is already
// excluded before adding a rule.
export const listExclusionRulesOperation = {
  summary: 'List exclusion rules',
  description:
    'Rules that stop discovery from going into, or recommending, a path. With `sourceId`, returns that source’s rules plus the global ones.',
  mcp: {
    name: 'list_exclusion_rules',
    description:
      'List the exclusion rules that apply to a source (its own plus the global ones). Check this before create_exclusion_rule: a path can have only one rule across a source and the global level. A directory under an `exclude_subtree` rule is skipped automatically when you next claim, so you never need to avoid it yourself.',
  },
} satisfies Operation;

export const listExclusionRules = handle(
  'GET /exclusion-rules',
  async (req, res) => {
    const filters = req.query as unknown as ExclusionRuleListQuery;
    res.status(200).json(await discoveryService.listExclusionRules(filters));
  },
);

// Does: create an exclusion rule (global when sourceId is null).
// Who: human (home-hud) | agent (create_exclusion_rule), source-scoped only.
export const createExclusionRuleOperation = {
  summary: 'Create an exclusion rule',
  description:
    'Precedence: an `exclude_subtree` rule on the path or any ancestor — global or source-specific — always wins; no rule can re-enable it. `selective_only` marks just that path as not a backup candidate and keeps exploring beneath it. A path may have only one rule across a source and the global level (409). Creating a rule never deletes candidates or their history; directories already queued under an `exclude_subtree` rule are skipped when they would next be claimed. Records an audit event; send X-Actor-Type / X-Actor-Id to attribute it.',
  mcp: {
    name: 'create_exclusion_rule',
    description:
      'Stop exploring, or stop recommending, a path on a source, for example generated output such as a build or node_modules directory. Scope `exclude_subtree`: the path and everything beneath it is skipped from now on, including directories already queued (they are skipped when claimed). Scope `selective_only`: the directory itself is not a backup candidate but you should still explore inside it. Always give a short reason; a human reviews it. Rules are per source (global rules are human-only) and one path has at most one rule, so a duplicate is rejected. This does not delete anything already recorded. You cannot edit or delete rules.',
  },
} satisfies Operation;

export const createExclusionRule = handle(
  'POST /exclusion-rules',
  async (req, res) => {
    const body = req.body as CreateExclusionRuleBody;
    res
      .status(201)
      .json(await discoveryService.createExclusionRule(body, actorOf(res)));
  },
);

// Does: change a rule's scope or reason. The path is fixed.
// Who: human (home-hud). No MCP tool.
export const updateExclusionRuleOperation = {
  summary: 'Update an exclusion rule’s scope or reason',
  description:
    'The path cannot change: delete the rule and create a new one. Records an audit event with before/after values; a request that changes nothing records none.',
} satisfies Operation;

export const updateExclusionRule = handle(
  'PATCH /exclusion-rules/:id',
  async (req, res) => {
    const { id } = req.params as ExclusionRuleIdParams;
    const body = req.body as UpdateExclusionRuleBody;
    res
      .status(200)
      .json(await discoveryService.updateExclusionRule(id, body, actorOf(res)));
  },
);

// Does: remove an exclusion rule.
// Who: human (home-hud). No MCP tool.
export const deleteExclusionRuleOperation = {
  summary: 'Delete an exclusion rule',
  description:
    'Takes effect for future claims only; items already skipped stay skipped. Records an audit event holding a snapshot of the removed rule.',
} satisfies Operation;

export const deleteExclusionRule = handle(
  'DELETE /exclusion-rules/:id',
  async (req, res) => {
    const { id } = req.params as ExclusionRuleIdParams;
    await discoveryService.deleteExclusionRule(id, actorOf(res));
    res.status(204).send();
  },
);
