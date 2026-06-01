import type { HarborArtifact } from '../api/harbor/harborClient';

export const SHA_TAG_RE = /^sha-([0-9a-f]{7})$/;
export const PR_TAG_RE = /^pr-(\d+)-([0-9a-f]{7})$/;
export const PROD_TAG_RE = /^(\d{8})-(\d+)-([0-9a-f]{7})$/;

export type ShaTag = { kind: 'sha'; sha7: string; tag: string; digest: string };
export type PrTag = {
  kind: 'pr';
  prNumber: number;
  sha7: string;
  tag: string;
  digest: string;
};
export type ProdTag = {
  kind: 'prod';
  date: string;
  run: number;
  sha7: string;
  tag: string;
  digest: string;
};
export type LegacyTag = { kind: 'legacy'; tag: string; digest: string };
export type ParsedTag = ShaTag | PrTag | ProdTag | LegacyTag;

export type TagCatalog = {
  sha: ShaTag[];
  pr: PrTag[];
  prod: ProdTag[];
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

  m = tag.match(PROD_TAG_RE);
  if (m)
    return {
      kind: 'prod',
      date: m[1],
      run: parseInt(m[2], 10),
      sha7: m[3],
      tag,
      digest,
    };

  return { kind: 'legacy', tag, digest };
}

export function catalogTags(artifacts: HarborArtifact[]): TagCatalog {
  const catalog: TagCatalog = { sha: [], pr: [], prod: [], legacy: [] };

  for (const artifact of artifacts) {
    for (const t of artifact.tags ?? []) {
      const parsed = parseTag(t.name, artifact.digest);
      (catalog[parsed.kind] as ParsedTag[]).push(parsed);
    }
  }

  return catalog;
}

export function sortProdTagsDesc(tags: ProdTag[]): ProdTag[] {
  return [...tags].sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    return d !== 0 ? d : b.run - a.run;
  });
}
