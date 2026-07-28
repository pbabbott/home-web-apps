/**
 * Metadata for one episode file, built up incrementally as pipeline steps
 * run — list-season-files sets filename/absPath, hash-episode-files adds
 * hash, and later steps (title-card detection, ...) add more.
 */
export type Episode = {
  filename: string;
  absPath: string;
  hash?: string;
};
