export type PawPatrolTitleCardsParameters = {
  seasonNumber: number;
  /** Overrides config.aiModel for this job's title-card detection calls, when set. */
  model?: string;
};

export const isPawPatrolTitleCardsParameters = (
  value: unknown,
): value is PawPatrolTitleCardsParameters =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PawPatrolTitleCardsParameters).seasonNumber === 'number' &&
  (typeof (value as PawPatrolTitleCardsParameters).model === 'undefined' ||
    typeof (value as PawPatrolTitleCardsParameters).model === 'string');
