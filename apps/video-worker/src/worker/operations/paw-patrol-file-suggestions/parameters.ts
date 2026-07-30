export type PawPatrolFileSuggestionsParameters = {
  seasonNumber: number;
  /** Overrides config.aiModel for this job's episode-matching AI calls, when set. */
  model?: string;
};

export const isPawPatrolFileSuggestionsParameters = (
  value: unknown,
): value is PawPatrolFileSuggestionsParameters =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PawPatrolFileSuggestionsParameters).seasonNumber ===
    'number' &&
  (typeof (value as PawPatrolFileSuggestionsParameters).model === 'undefined' ||
    typeof (value as PawPatrolFileSuggestionsParameters).model === 'string');
