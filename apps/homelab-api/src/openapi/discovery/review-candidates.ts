import { z } from 'zod';
import { reviewCandidateSelectSchema } from '@abbottland/homelab-db';
import { validationErrorResponse } from '../common';
import {
  actorHeaders,
  conflictResponse,
  discoveryNotFoundResponse,
  exclusionResolutionSchema,
} from './common';
import {
  decideReviewCandidateOperation,
  getReviewCandidateOperation,
  listReviewCandidatesOperation,
  proposeReviewCandidatesOperation,
} from '../../controllers/discovery/review-candidates';
import {
  candidateEvidenceSchema,
  decideReviewCandidateBodySchema,
  proposeReviewCandidatesBodySchema,
  queueItemIdParamsSchema,
  reviewCandidateIdParamsSchema,
  reviewCandidateListQuerySchema,
  sourceIdParamsSchema,
} from '../../schemas/discovery';

// The stored evidence is typed in homelab-db; document the shape the API
// validates instead of the generic JSON the select schema derives.
const candidateSchema = reviewCandidateSelectSchema.extend({
  evidence: candidateEvidenceSchema,
});

const upsertedCandidateSchema = candidateSchema.extend({
  created: z.boolean().meta({
    description: 'true if this proposal created the candidate.',
  }),
  changed: z.boolean().meta({
    description:
      'true if an existing candidate’s recommendation, evidence or other agent fields changed.',
  }),
});

const candidateWithExclusionSchema = candidateSchema.extend({
  exclusion: exclusionResolutionSchema,
});

export const reviewCandidatesPaths = {
  '/queue-items/{id}/review-candidates': {
    post: {
      summary: proposeReviewCandidatesOperation.summary,
      description: proposeReviewCandidatesOperation.description,
      requestParams: { path: queueItemIdParamsSchema },
      requestBody: {
        content: {
          'application/json': { schema: proposeReviewCandidatesBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The candidates, in request order',
          content: {
            'application/json': { schema: z.array(upsertedCandidateSchema) },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('queue item'),
        '409': conflictResponse(
          'The claim is no longer valid, a path is outside the claimed directory, or a path is covered by an exclusion rule',
        ),
      },
    },
  },
  '/sources/{id}/review-candidates': {
    get: {
      summary: listReviewCandidatesOperation.summary,
      description: listReviewCandidatesOperation.description,
      requestParams: {
        path: sourceIdParamsSchema,
        query: reviewCandidateListQuerySchema,
      },
      responses: {
        '200': {
          description: 'The review candidates',
          content: {
            'application/json': { schema: z.array(candidateSchema) },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('source'),
      },
    },
  },
  '/review-candidates/{id}': {
    get: {
      summary: getReviewCandidateOperation.summary,
      description: getReviewCandidateOperation.description,
      requestParams: { path: reviewCandidateIdParamsSchema },
      responses: {
        '200': {
          description: 'The review candidate',
          content: {
            'application/json': { schema: candidateWithExclusionSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('review candidate'),
      },
    },
  },
  '/review-candidates/{id}/decision': {
    patch: {
      summary: decideReviewCandidateOperation.summary,
      description: decideReviewCandidateOperation.description,
      requestParams: {
        path: reviewCandidateIdParamsSchema,
        header: actorHeaders,
      },
      requestBody: {
        content: {
          'application/json': { schema: decideReviewCandidateBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The decided candidate',
          content: { 'application/json': { schema: candidateSchema } },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('review candidate'),
        '409': conflictResponse(
          'The actor is not a human, or the path is covered by an exclusion rule and cannot be approved',
        ),
      },
    },
  },
};
