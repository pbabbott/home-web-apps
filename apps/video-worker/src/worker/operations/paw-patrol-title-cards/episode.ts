import type { TitleCard } from '@abbottland/video-db';
import type { TitleCardDetection } from './lib/detect-title-card';

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
  /** Probed (ffprobe) duration in seconds. Only computed for episodes missing title_cards records. */
  runTimeSeconds?: number;
  /** MEDIA_ROOT-relative screenshot paths generated for episodes missing title_cards records. */
  screenshotPaths?: string[];
  /** Per-screenshot AI detection results, one per entry in screenshotPaths. Only checked for episodes missing title_cards records. */
  titleCardDetections?: TitleCardDetection[];
};
