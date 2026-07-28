export type PawPatrolTitleCardsParameters = {
  seasonNumber: number;
};

export const isPawPatrolTitleCardsParameters = (
  value: unknown,
): value is PawPatrolTitleCardsParameters =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PawPatrolTitleCardsParameters).seasonNumber === 'number';
