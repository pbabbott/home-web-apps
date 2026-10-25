/** A human's "I agree with this skip", kept per source and path. */
export interface SkipAcknowledgement {
  id: string;
  sourceId: string;
  path: string;
  /** Lowercased path the API matches on. */
  normalizedPath: string;
  /** Empty for a path skip; the name pattern for a "skipped by pattern" entry. */
  pattern: string;
  acknowledgedBy: string;
  createdAt: string;
}

/** Key of one skip in a set of acknowledged skips. */
export function skipKey(path: string, pattern = ''): string {
  return `${path.toLowerCase()}|${pattern}`;
}
