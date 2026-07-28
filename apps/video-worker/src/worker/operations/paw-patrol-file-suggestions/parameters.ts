export type PawPatrolFileSuggestionsParameters = {
  seasonNumber: number;
};

export const isPawPatrolFileSuggestionsParameters = (
  value: unknown,
): value is PawPatrolFileSuggestionsParameters =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PawPatrolFileSuggestionsParameters).seasonNumber ===
    'number';
