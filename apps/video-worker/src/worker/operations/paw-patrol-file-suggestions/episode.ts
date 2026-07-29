import type { FileRename, TitleCard } from '@abbottland/video-db';

/**
 * Metadata for one episode file, built up incrementally as pipeline steps
 * run — list-season-files sets filename/absPath, hash-episode-files adds
 * hash, check-existing-suggestions adds existingSuggestion (if any), and
 * later steps add title cards and the computed suggestion.
 */
export type Episode = {
  filename: string;
  absPath: string;
  hash?: string;
  /** An existing file_renames row for this episode's hash, if one was already suggested — presence means the rest of the pipeline is skipped for this episode. */
  existingSuggestion?: FileRename;
  /** Existing title_cards rows for this episode's hash, used as evidence for the AI's episode match. Only loaded for episodes with no existingSuggestion. */
  titleCards?: TitleCard[];
  /** MEDIA_ROOT-relative destination path computed by suggest-filenames, ready to be saved by save-suggestions. */
  suggestedFilePath?: string;
  /** title_cards titles the AI was given as evidence for suggestedFilePath — one per matched episode, in file order. Set alongside suggestedFilePath by suggest-filenames. */
  sourceTitleCardTitles?: string[];
};
