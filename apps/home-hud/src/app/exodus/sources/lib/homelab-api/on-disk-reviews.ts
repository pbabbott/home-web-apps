/** A human's "I looked at what is on disk in this directory", kept per source and path. */
export interface OnDiskReview {
  id: string;
  sourceId: string;
  path: string;
  /** Lowercased path the API matches on. */
  normalizedPath: string;
  reviewedBy: string;
  createdAt: string;
}
