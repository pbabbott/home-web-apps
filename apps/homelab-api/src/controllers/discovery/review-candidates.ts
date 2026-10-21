import * as discoveryService from '../../services/discovery';
import { actorOf } from '../../lib/actor';
import { handle } from './handle';
import type { Operation } from '../operation';
import type {
  DecideReviewCandidateBody,
  ProposeReviewCandidatesBody,
  QueueItemIdParams,
  ReviewCandidateIdParams,
  ReviewCandidateListQuery,
  SourceIdParams,
} from '../../schemas/discovery';
import { MAX_CANDIDATES_PER_REQUEST } from '../../schemas/discovery';

// Does: create or update the agent's recommendation for backup units found in
// a claimed directory.
// Who: agent (propose_review_candidates).
export const proposeReviewCandidatesOperation = {
  summary: 'Propose review candidates for a claimed directory',
  description: `A candidate is a proposed backup unit, usually a directory (one repository or photo folder, not one per file or subfolder) and occasionally a standalone file. It creates no queue items. Upserts by source + normalized root path, so repeating a call or rediscovering in a later job updates the same candidate instead of duplicating it. Each root path must be the claimed directory or lie inside it. Writes only the agent's fields (recommendation, confidence, reason, evidence); it never touches a human decision, and a recommendation is never an approval. Audit events are written only when a candidate is created or its recommendation/confidence changes. Guardrails (400): back_up/skip need medium or high confidence (low means needs_review); a git repository can only be skipped when its local state is known and clean. Nesting is allowed, but each result lists coveredBy (existing candidates whose root is an ancestor) and covers (existing candidates beneath it), with their decision; nothing is inherited, so check them and avoid proposing a repository's internal folders. A path covered by an exclusion rule rejects the batch (409). Up to ${MAX_CANDIDATES_PER_REQUEST} per call.`,
  mcp: {
    name: 'propose_review_candidates',
    description: `Record your backup recommendation (a candidate; it creates no queue items) for one or more logical backup units (a project/repository root, a personal-data folder, a standalone file) found while inspecting a claimed directory. Idempotent per path: re-proposing updates the existing candidate and never changes a human's approval or rejection. Give a short summary, a recommendation (back_up | skip | needs_review), confidence (low | medium | high, where low must be needs_review), a reason, and evidence made only of facts you observed, with unknowns in openQuestions. A repository is ONE candidate; do not propose its subfolders. Each result carries coveredBy / covers (existing candidates that contain or sit inside this one): if coveredBy is non-empty, reconsider whether this should be a separate candidate. A git repo may only be recommended skip if you checked that it has no uncommitted changes, untracked files or unpushed commits; a public remote alone is not enough, so otherwise use needs_review. Maximum ${MAX_CANDIDATES_PER_REQUEST} per call.`,
  },
} satisfies Operation;

export const proposeReviewCandidates = handle(
  'POST /queue-items/:id/review-candidates',
  async (req, res) => {
    const { id } = req.params as QueueItemIdParams;
    const { claimToken, workerId, candidates } =
      req.body as ProposeReviewCandidatesBody;
    const results = await discoveryService.proposeCandidates(
      id,
      claimToken,
      workerId ?? null,
      candidates,
    );
    res.status(200).json(
      results.map(({ candidate, created, changed, coveredBy, covers }) => ({
        ...candidate,
        created,
        changed,
        coveredBy,
        covers,
      })),
    );
  },
);

// Does: page through a source's review candidates with filters.
// Who: human (REST) and agent (list_review_candidates).
export const listReviewCandidatesOperation = {
  summary: 'List a source’s review candidates',
  description:
    'Ordered by normalizedRootPath. Up to `limit` (default 100, max 500) per page; pass the last normalizedRootPath as `after` for the next page. Filter by last-proposing job, recommendation, decision, or path prefix.',
  mcp: {
    name: 'list_review_candidates',
    description:
      'List the review candidates already recorded for a source (filter by recommendation, decision, jobId or pathPrefix). Check this before proposing, to see what earlier runs found and what a human has already decided.',
  },
} satisfies Operation;

export const listSourceReviewCandidates = handle(
  'GET /sources/:id/review-candidates',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    const filters = req.query as unknown as ReviewCandidateListQuery;
    res
      .status(200)
      .json(await discoveryService.listSourceReviewCandidates(id, filters));
  },
);

// Does: fetch one candidate, with how exclusion rules currently treat it.
// Who: human. No MCP tool.
export const getReviewCandidateOperation = {
  summary: 'Get a review candidate',
  description:
    'Includes `exclusion`: `none`, `selective` or `excluded`, with the deciding rule ids. An excluded or selective path cannot be approved.',
} satisfies Operation;

export const getReviewCandidate = handle(
  'GET /review-candidates/:id',
  async (req, res) => {
    const { id } = req.params as ReviewCandidateIdParams;
    res.status(200).json(await discoveryService.getReviewCandidate(id));
  },
);

// Does: record a human's approval or rejection.
// Who: human only (REST). Deliberately no MCP tool.
export const decideReviewCandidateOperation = {
  summary: 'Approve or reject a review candidate',
  description:
    'Sets `approved`, `rejected`, or back to `pending`, with an optional note. Only a human actor may decide (X-Actor-Type other than human is 409). Approval is refused for paths under an exclusion rule. An approval normally covers the candidate’s whole subtree; it is the authorization and scope for a future copy workflow and changes nothing else. Repeating the current decision and note changes nothing and records no audit event. Rediscovery never resets a decision.',
} satisfies Operation;

export const decideReviewCandidate = handle(
  'PATCH /review-candidates/:id/decision',
  async (req, res) => {
    const { id } = req.params as ReviewCandidateIdParams;
    const body = req.body as DecideReviewCandidateBody;
    res
      .status(200)
      .json(
        await discoveryService.decideReviewCandidate(id, body, actorOf(res)),
      );
  },
);
