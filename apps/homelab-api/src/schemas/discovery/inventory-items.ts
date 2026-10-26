import { z } from 'zod';
import { claimTokenSchema, windowsPathSchema } from './common';

// Kept small so a worst-case batch stays under the shared Express json() body
// limit of 100kb (evidence alone can reach ~6kb per inventory item).
export const MAX_INVENTORY_ITEMS_PER_REQUEST = 10;

export const inventoryItemIdParamsSchema = z.object({ id: z.uuid() });
export type InventoryItemIdParams = z.infer<typeof inventoryItemIdParamsSchema>;

const shortText = z.string().trim().min(1).max(300);

export const inventoryItemRecommendationSchema = z
  .enum(['back_up', 'skip', 'needs_review'])
  .meta({
    description:
      'back_up: unique or valuable. skip: strong evidence it is irrelevant or reproducible. needs_review: not enough evidence.',
  });

export const inventoryItemConfidenceSchema = z
  .enum(['low', 'medium', 'high'])
  .meta({
    description:
      'Not a probability. high: direct evidence. medium: strong signals, minor unknowns. low: a guess (needs_review only).',
  });

export const inventoryItemEvidenceSchema = z.object({
  contentKinds: z
    .array(
      z.enum([
        'source_code',
        'personal_documents',
        'media',
        'configuration',
        'application_data',
        'generated_artifacts',
        'installed_software',
        'installers',
        'archives',
        'other',
      ]),
    )
    .max(8),
  git: z
    .object({
      remoteUrl: z.string().max(500).nullable(),
      remoteVisibility: z.enum(['public', 'private', 'none', 'unknown']),
      localStateKnown: z.boolean().meta({
        description:
          'True only when git status and the upstream comparison actually ran.',
      }),
      uncommittedChanges: z.boolean().nullable(),
      untrackedFiles: z.boolean().nullable(),
      unpushedCommits: z.boolean().nullable(),
      ignoredFilesOfNote: z.boolean().nullable(),
    })
    .nullable()
    .meta({
      description:
        'null when the path is not a git repository (or was not checked). Inside, null means not determined.',
    }),
  reproducible: z.enum(['yes', 'no', 'unknown']),
  sufficientInformation: z.boolean().meta({
    description: 'Whether the agent had enough information to be confident.',
  }),
  observations: z.array(shortText).max(10).meta({
    description: 'Verified facts only; no speculation.',
  }),
  openQuestions: z.array(shortText).max(5).meta({
    description: 'What further inspection would resolve the uncertainty.',
  }),
  estimatedSizeBytes: z
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER)
    .optional(),
  estimatedFileCount: z
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER)
    .optional(),
});

export const inventoryItemInputSchema = z
  .object({
    rootPath: windowsPathSchema.meta({
      description:
        'The backup unit: a directory (project, document collection) or a standalone file. Must be the claimed directory or lie inside it.',
    }),
    kind: z.enum(['file', 'directory']),
    displayName: z.string().trim().min(1).max(200).optional().meta({
      description: 'Defaults to the last path segment.',
    }),
    summary: z.string().trim().min(1).max(500),
    recommendation: inventoryItemRecommendationSchema,
    confidence: inventoryItemConfidenceSchema,
    reason: z.string().trim().min(1).max(500).meta({
      description: 'Why this recommendation.',
    }),
    evidence: inventoryItemEvidenceSchema,
  })
  .superRefine((c, ctx) => {
    if (c.confidence === 'low' && c.recommendation !== 'needs_review') {
      ctx.addIssue({
        code: 'custom',
        path: ['confidence'],
        message:
          'low confidence requires recommendation needs_review; use back_up or skip only with medium or high confidence',
      });
    }

    const git = c.evidence.git;
    if (
      c.recommendation === 'skip' &&
      git &&
      (!git.localStateKnown ||
        git.uncommittedChanges !== false ||
        git.untrackedFiles !== false ||
        git.unpushedCommits !== false ||
        git.ignoredFilesOfNote === true)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['recommendation'],
        message:
          'a git repository can only be skipped when its local state is known and shows no uncommitted changes, untracked files, unpushed commits or notable ignored files; a public remote alone does not make it disposable (use needs_review)',
      });
    }
  });
export type InventoryItemInput = z.infer<typeof inventoryItemInputSchema>;

export const proposeInventoryItemsBodySchema = z.object({
  claimToken: claimTokenSchema,
  inventoryItems: z
    .array(inventoryItemInputSchema)
    .min(1)
    .max(MAX_INVENTORY_ITEMS_PER_REQUEST),
});
export type ProposeInventoryItemsBody = z.infer<
  typeof proposeInventoryItemsBodySchema
>;

export const inventoryItemListQuerySchema = z.object({
  jobId: z.uuid().optional().meta({
    description: 'Only inventory items last proposed by this job.',
  }),
  recommendation: inventoryItemRecommendationSchema.optional(),
  decision: z.enum(['pending', 'approved', 'rejected']).optional(),
  pathPrefix: windowsPathSchema.optional().meta({
    description: 'Only inventory items at or beneath this path.',
  }),
  after: z.string().min(1).optional().meta({
    description:
      'Cursor: the normalizedRootPath of the last inventory item of the previous page.',
  }),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type InventoryItemListQuery = z.infer<
  typeof inventoryItemListQuerySchema
>;

export const decideInventoryItemBodySchema = z.object({
  decision: z.enum(['pending', 'approved', 'rejected']),
  note: z.string().trim().min(1).max(1000).nullable().optional().meta({
    description:
      'Replaces the note; null clears it. When omitted the note is kept if the decision is unchanged and cleared if it changes.',
  }),
});
export type DecideInventoryItemBody = z.infer<
  typeof decideInventoryItemBodySchema
>;

export const promoteInventoryItemBodySchema = z.object({
  path: windowsPathSchema.meta({
    description:
      'A path inside the queue item’s directory, usually one listed in its `skipped`.',
  }),
  kind: z.enum(['file', 'directory']),
  displayName: shortText.optional(),
  note: z.string().trim().min(1).max(1000).optional().meta({
    description: 'Stored as the decision note.',
  }),
  skipReason: z.string().trim().min(1).max(1000).optional().meta({
    description: 'Why the agent skipped it; kept for the audit trail.',
  }),
});
export type PromoteInventoryItemBody = z.infer<
  typeof promoteInventoryItemBodySchema
>;

export const inventoryDirectoryBodySchema = z.object({
  note: z.string().trim().min(1).max(1000).optional().meta({
    description: 'Stored as the decision note.',
  }),
});
export type InventoryDirectoryBody = z.infer<
  typeof inventoryDirectoryBodySchema
>;
