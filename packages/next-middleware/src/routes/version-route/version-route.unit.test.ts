import { versionRoute } from './version-route';

describe('versionRoute (unit test)', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('reads IMAGE_TAG at request time, not import time', async () => {
    delete process.env['IMAGE_TAG'];
    expect((await (await versionRoute()).json()).tag).toBe('dev');

    process.env['IMAGE_TAG'] = '20261110-00091-00248-e2ba7c3';
    const response = await versionRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      tag: '20261110-00091-00248-e2ba7c3',
      environment: 'prod',
      date: '2026-11-10',
      run: 91,
      pr: 248,
      sha: 'e2ba7c3',
    });
  });

  it('is never cached', async () => {
    const response = await versionRoute();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('uses PR_NUMBER for preview environments', async () => {
    process.env['IMAGE_TAG'] = 'sha-abc1234';
    process.env['PR_NUMBER'] = '251';
    const body = await (await versionRoute()).json();
    expect(body).toMatchObject({ environment: 'preview', pr: 251 });
  });
});
