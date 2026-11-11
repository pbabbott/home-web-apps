import { parseImageInfo } from './parse-image-info';

describe('parseImageInfo (unit test)', () => {
  it('describes a production tag', () => {
    expect(parseImageInfo('20261110-00091-00248-e2ba7c3')).toEqual({
      tag: '20261110-00091-00248-e2ba7c3',
      environment: 'prod',
      date: '2026-11-10',
      run: 91,
      pr: 248,
      sha: 'e2ba7c3',
      label: 'prod · 20261110-00091-00248-e2ba7c3 · 2026-11-10 · PR #248',
    });
  });

  it('omits the PR for a direct push (00000)', () => {
    const info = parseImageInfo('20261110-00091-00000-e2ba7c3');
    expect(info.pr).toBeNull();
    expect(info.label).toBe('prod · 20261110-00091-00000-e2ba7c3 · 2026-11-10');
  });

  it('still understands the previous prod tag shape', () => {
    expect(parseImageInfo('20261110-91-e2ba7c3')).toMatchObject({
      environment: 'prod',
      date: '2026-11-10',
      run: 91,
      pr: null,
      sha: 'e2ba7c3',
      label: 'prod · 20261110-91-e2ba7c3 · 2026-11-10',
    });
  });

  it('describes a preview build with its PR', () => {
    expect(parseImageInfo('sha-abc1234', '251')).toMatchObject({
      environment: 'preview',
      pr: 251,
      sha: 'abc1234',
      label: 'preview · PR #251 · sha-abc1234',
    });
  });

  it('describes a preview build without a PR number', () => {
    expect(parseImageInfo('sha-abc1234').label).toBe('preview · sha-abc1234');
    expect(parseImageInfo('sha-abc1234', 'nope').pr).toBeNull();
  });

  it('renders exactly `dev` when unset, empty or dev', () => {
    for (const tag of [undefined, '', 'dev']) {
      expect(parseImageInfo(tag)).toMatchObject({
        tag: 'dev',
        environment: 'dev',
        label: 'dev',
      });
    }
  });

  it('shows an unrecognised tag verbatim', () => {
    expect(parseImageInfo('weird-tag')).toMatchObject({
      tag: 'weird-tag',
      environment: 'dev',
      label: 'weird-tag',
    });
  });
});
