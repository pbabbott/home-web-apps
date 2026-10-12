export type PawPatrolApplyFileRenamesParameters = Record<string, never>;

/**
 * This operation takes no parameters — it processes every pending
 * file_renames row, not a season-scoped subset. Only guards that
 * `job.parameters` is object-shaped, matching the other operations'
 * front-loaded parameter check even though there's nothing to read out of it.
 */
export const isPawPatrolApplyFileRenamesParameters = (
  value: unknown,
): value is PawPatrolApplyFileRenamesParameters =>
  typeof value === 'object' && value !== null;
