import type { HarborArtifact } from '../api/harbor/harborClient';

export const SHA_TAG_RE = /^sha-([0-9a-f]{7})$/;
/** Legacy per-commit PR tag: pr-<N>-<sha7> */
export const PR_TAG_RE = /^pr-(\d+)-([0-9a-f]{7})$/;
/** Moving per-PR tag: pr-<N> (always points at the PR's latest build) */
export const PR_MOVING_TAG_RE = /^pr-(\d+)$/;
/** v2 production tag: YYYYMMDD-<RUN:5>-<PR:5>-<sha7> */
export const PROD_V2_TAG_RE = /^(\d{8})-(\d{5})-(\d{5})-([0-9a-f]{7})$/;
/** v1 production tag: YYYYMMDD-<RUN>-<sha7> (kept while old tags age out) */
export const PROD_TAG_RE = /^(\d{8})-(\d+)-([0-9a-f]{7})$/;
/** Floating tags that are never cleaned up. */
export const FLOATING_TAG_RE = /^latest$/;

export type ShaTag = { kind: 'sha'; sha7: string; tag: string; digest: string };
export type PrTag = {
  kind: 'pr';
  prNumber: number;
  sha7: string;
  tag: string;
  digest: string;
};
export type PrMovingTag = {
  kind: 'prMoving';
  prNumber: number;
  tag: string;
  digest: string;
};
export type ProdTag = {
  kind: 'prod';
  /** 'v1' = YYYYMMDD-RUN-sha7, 'v2' = YYYYMMDD-RUN:5-PR:5-sha7 */
  format: 'v1' | 'v2';
  date: string;
  run: number;
  /** PR number from a v2 tag; null for v1 and for direct pushes (00000). */
  prNumber: number | null;
  sha7: string;
  tag: string;
  digest: string;
};
export type FloatingTag = { kind: 'floating'; tag: string; digest: string };
export type LegacyTag = { kind: 'legacy'; tag: string; digest: string };
export type ParsedTag =
  | ShaTag
  | PrTag
  | PrMovingTag
  | ProdTag
  | FloatingTag
  | LegacyTag;

export type TagCatalog = {
  sha: ShaTag[];
  pr: PrTag[];
  prMoving: PrMovingTag[];
  prod: ProdTag[];
  floating: FloatingTag[];
  legacy: LegacyTag[];
};

export function parseTag(tag: string, digest: string): ParsedTag {
  let m: RegExpMatchArray | null;

  m = tag.match(SHA_TAG_RE);
  if (m) return { kind: 'sha', sha7: m[1], tag, digest };

  m = tag.match(PR_TAG_RE);
  if (m)
    return {
      kind: 'pr',
      prNumber: parseInt(m[1], 10),
      sha7: m[2],
      tag,
      digest,
    };

  m = tag.match(PR_MOVING_TAG_RE);
  if (m) return { kind: 'prMoving', prNumber: parseInt(m[1], 10), tag, digest };

  m = tag.match(PROD_V2_TAG_RE);
  if (m) {
    const prNumber = parseInt(m[3], 10);
    return {
      kind: 'prod',
      format: 'v2',
      date: m[1],
      run: parseInt(m[2], 10),
      prNumber: prNumber === 0 ? null : prNumber,
      sha7: m[4],
      tag,
      digest,
    };
  }

  m = tag.match(PROD_TAG_RE);
  if (m)
    return {
      kind: 'prod',
      format: 'v1',
      date: m[1],
      run: parseInt(m[2], 10),
      prNumber: null,
      sha7: m[3],
      tag,
      digest,
    };

  if (FLOATING_TAG_RE.test(tag)) return { kind: 'floating', tag, digest };

  return { kind: 'legacy', tag, digest };
}

export function catalogTags(artifacts: HarborArtifact[]): TagCatalog {
  const catalog: TagCatalog = {
    sha: [],
    pr: [],
    prMoving: [],
    prod: [],
    floating: [],
    legacy: [],
  };

  for (const artifact of artifacts) {
    for (const t of artifact.tags ?? []) {
      const parsed = parseTag(t.name, artifact.digest);
      (catalog[parsed.kind] as ParsedTag[]).push(parsed);
    }
  }

  return catalog;
}

/**
 * Newest first. Both formats share the same docker-publish run counter, so
 * date then run orders v1 and v2 tags correctly against each other.
 */
export function sortProdTagsDesc(tags: ProdTag[]): ProdTag[] {
  return [...tags].sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    return d !== 0 ? d : b.run - a.run;
  });
}
