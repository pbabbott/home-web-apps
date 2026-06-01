import {
  parseTag,
  catalogTags,
  sortProdTagsDesc,
} from '../../src/services/tagParser';
import type { HarborArtifact } from '../../src/api/harbor/harborClient';

const DIGEST = 'sha256:abc';

describe('parseTag', () => {
  it('parses sha tags', () => {
    const result = parseTag('sha-abc1234', DIGEST);
    expect(result).toEqual({
      kind: 'sha',
      sha7: 'abc1234',
      tag: 'sha-abc1234',
      digest: DIGEST,
    });
  });

  it('parses pr tags', () => {
    const result = parseTag('pr-105-abc1234', DIGEST);
    expect(result).toEqual({
      kind: 'pr',
      prNumber: 105,
      sha7: 'abc1234',
      tag: 'pr-105-abc1234',
      digest: DIGEST,
    });
  });

  it('parses prod tags', () => {
    const result = parseTag('20260601-42-abc1234', DIGEST);
    expect(result).toEqual({
      kind: 'prod',
      date: '20260601',
      run: 42,
      sha7: 'abc1234',
      tag: '20260601-42-abc1234',
      digest: DIGEST,
    });
  });

  it('classifies semver as legacy', () => {
    expect(parseTag('0.7.0', DIGEST)).toEqual({
      kind: 'legacy',
      tag: '0.7.0',
      digest: DIGEST,
    });
    expect(parseTag('v1.2.3', DIGEST)).toEqual({
      kind: 'legacy',
      tag: 'v1.2.3',
      digest: DIGEST,
    });
  });

  it('classifies unknown tags as legacy', () => {
    expect(parseTag('latest', DIGEST)).toEqual({
      kind: 'legacy',
      tag: 'latest',
      digest: DIGEST,
    });
    expect(parseTag('main', DIGEST)).toEqual({
      kind: 'legacy',
      tag: 'main',
      digest: DIGEST,
    });
  });
});

describe('catalogTags', () => {
  it('sorts tags into correct buckets', () => {
    const artifacts: HarborArtifact[] = [
      {
        digest: 'sha256:aaa',
        tags: [{ name: 'sha-abc1234' }, { name: '20260601-1-abc1234' }],
      },
      { digest: 'sha256:bbb', tags: [{ name: 'pr-42-def5678' }] },
      { digest: 'sha256:ccc', tags: [{ name: '0.6.0' }] },
      { digest: 'sha256:ddd', tags: [] },
    ];

    const catalog = catalogTags(artifacts);

    expect(catalog.sha).toHaveLength(1);
    expect(catalog.prod).toHaveLength(1);
    expect(catalog.pr).toHaveLength(1);
    expect(catalog.legacy).toHaveLength(1);
  });
});

describe('sortProdTagsDesc', () => {
  it('sorts by date descending then run descending', () => {
    const tags = [
      {
        kind: 'prod' as const,
        date: '20260601',
        run: 1,
        sha7: 'aaa0001',
        tag: '20260601-1-aaa0001',
        digest: 'sha256:1',
      },
      {
        kind: 'prod' as const,
        date: '20260601',
        run: 5,
        sha7: 'bbb0002',
        tag: '20260601-5-bbb0002',
        digest: 'sha256:2',
      },
      {
        kind: 'prod' as const,
        date: '20260530',
        run: 3,
        sha7: 'ccc0003',
        tag: '20260530-3-ccc0003',
        digest: 'sha256:3',
      },
    ];

    const sorted = sortProdTagsDesc(tags);

    expect(sorted[0].tag).toBe('20260601-5-bbb0002');
    expect(sorted[1].tag).toBe('20260601-1-aaa0001');
    expect(sorted[2].tag).toBe('20260530-3-ccc0003');
  });
});
