export type ImageEnvironment = 'prod' | 'preview' | 'dev';

export interface ImageInfo {
  /** The raw IMAGE_TAG the pod is running, or `dev` when unset. */
  tag: string;
  environment: ImageEnvironment;
  /** Merge date (UTC) from a production tag, as YYYY-MM-DD. */
  date: string | null;
  /** docker-publish run number from a production tag. */
  run: number | null;
  /** Merged PR (prod tags) or the preview's PR; null when unknown or a direct push. */
  pr: number | null;
  /** Short git sha of the build, when the tag carries one. */
  sha: string | null;
  /** One-line text for a page footer. */
  label: string;
}

/** YYYYMMDD-<RUN:5>-<PR:5>-<sha7>, created by scripts/docker-retag-prod.sh on merge to main. */
const PROD_TAG_RE = /^(\d{8})-(\d{5})-(\d{5})-([0-9a-f]{7})$/;
/** Previous shape YYYYMMDD-<run>-<sha7>, still deployed until the first new-shape release. */
const PROD_LEGACY_TAG_RE = /^(\d{8})-(\d+)-([0-9a-f]{7})$/;
/** PR build image, used by preview environments. */
const SHA_TAG_RE = /^sha-([0-9a-f]{7})$/;

const toIsoDate = (yyyymmdd: string): string =>
  `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

const toPr = (value: string | undefined): number | null => {
  if (!value || !/^\d+$/.test(value)) return null;
  const pr = parseInt(value, 10);
  return pr > 0 ? pr : null;
};

const DEV: ImageInfo = {
  tag: 'dev',
  environment: 'dev',
  date: null,
  run: null,
  pr: null,
  sha: null,
  label: 'dev',
};

/**
 * Describes what is running from the pod's IMAGE_TAG (set by Flux for prod, by
 * deploy-preview.sh for previews). `prNumber` is only used for previews.
 */
export const parseImageInfo = (
  tag: string | undefined,
  prNumber?: string,
): ImageInfo => {
  if (!tag || tag === 'dev') return DEV;

  let m = tag.match(PROD_TAG_RE);
  if (m) {
    const date = toIsoDate(m[1]);
    const pr = toPr(m[3]);
    return {
      tag,
      environment: 'prod',
      date,
      run: parseInt(m[2], 10),
      pr,
      sha: m[4],
      label: ['prod', tag, date, pr ? `PR #${pr}` : null]
        .filter(Boolean)
        .join(' · '),
    };
  }

  m = tag.match(PROD_LEGACY_TAG_RE);
  if (m) {
    const date = toIsoDate(m[1]);
    return {
      tag,
      environment: 'prod',
      date,
      run: parseInt(m[2], 10),
      pr: null,
      sha: m[3],
      label: ['prod', tag, date].join(' · '),
    };
  }

  m = tag.match(SHA_TAG_RE);
  if (m) {
    const pr = toPr(prNumber);
    return {
      tag,
      environment: 'preview',
      date: null,
      run: null,
      pr,
      sha: m[1],
      label: ['preview', pr ? `PR #${pr}` : null, tag]
        .filter(Boolean)
        .join(' · '),
    };
  }

  // Unrecognised shape: show it verbatim rather than hiding it.
  return { ...DEV, tag, label: tag };
};
