export type FileSuggestionsParameters = {
  /** Display name of the series to process — looked up in the series table to resolve its on-disk directory name. */
  series: string;
  seasonNumber: number;
  /** Overrides config.aiModel for this job's episode-matching AI calls, when set. */
  model?: string;
};

export const isFileSuggestionsParameters = (
  value: unknown,
): value is FileSuggestionsParameters =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as FileSuggestionsParameters).series === 'string' &&
  typeof (value as FileSuggestionsParameters).seasonNumber === 'number' &&
  (typeof (value as FileSuggestionsParameters).model === 'undefined' ||
    typeof (value as FileSuggestionsParameters).model === 'string');
