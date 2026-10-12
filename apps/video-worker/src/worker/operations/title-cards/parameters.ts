export type TitleCardsParameters = {
  /** Display name of the series to process — looked up in the series table to resolve its on-disk directory name. */
  series: string;
  seasonNumber: number;
  /** Overrides config.aiModel for this job's title-card detection calls, when set. */
  model?: string;
};

export const isTitleCardsParameters = (
  value: unknown,
): value is TitleCardsParameters =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as TitleCardsParameters).series === 'string' &&
  typeof (value as TitleCardsParameters).seasonNumber === 'number' &&
  (typeof (value as TitleCardsParameters).model === 'undefined' ||
    typeof (value as TitleCardsParameters).model === 'string');
