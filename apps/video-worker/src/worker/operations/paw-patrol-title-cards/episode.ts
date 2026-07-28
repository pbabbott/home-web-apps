import type { TitleCard } from '@abbottland/video-db';

/**
 * Metadata for one episode file, built up incrementally as pipeline steps
 * run — list-season-files sets filename/absPath, hash-episode-files adds
 * hash, check-title-card-records adds titleCards, and later steps add
 * more.
 */
export type Episode = {
  filename: string;
  absPath: string;
  hash?: string;
  /** Existing title_cards rows for this episode's hash. Empty means this episode still needs title-card data generated. */
  titleCards?: TitleCard[];
};
