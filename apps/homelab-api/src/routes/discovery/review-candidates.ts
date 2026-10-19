import { Router } from 'express';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '@abbottland/express';
import {
  decideReviewCandidate,
  getReviewCandidate,
  listSourceReviewCandidates,
  proposeReviewCandidates,
} from '../../controllers/discovery/review-candidates';
import { parseActor } from '../../lib/actor';
import {
  decideReviewCandidateBodySchema,
  proposeReviewCandidatesBodySchema,
  queueItemIdParamsSchema,
  reviewCandidateIdParamsSchema,
  reviewCandidateListQuerySchema,
  sourceIdParamsSchema,
} from '../../schemas/discovery';

export const reviewCandidatesRouter = Router();

reviewCandidatesRouter.post(
  '/queue-items/:id/review-candidates',
  validateParams(queueItemIdParamsSchema),
  validateBody(proposeReviewCandidatesBodySchema),
  proposeReviewCandidates,
);
reviewCandidatesRouter.get(
  '/sources/:id/review-candidates',
  validateParams(sourceIdParamsSchema),
  validateQuery(reviewCandidateListQuerySchema),
  listSourceReviewCandidates,
);
reviewCandidatesRouter.get(
  '/review-candidates/:id',
  validateParams(reviewCandidateIdParamsSchema),
  getReviewCandidate,
);
reviewCandidatesRouter.patch(
  '/review-candidates/:id/decision',
  parseActor,
  validateParams(reviewCandidateIdParamsSchema),
  validateBody(decideReviewCandidateBodySchema),
  decideReviewCandidate,
);
