describe('blog smoke tests', () => {
  const BASE_URL = `http://localhost:${process.env.PORT ?? 4020}`;

  it.each([
    '/',
    '/blog',
    '/system-architecture',
    '/series',
    '/api/healthz',
    '/sitemap.xml',
    '/robots.txt',
    '/feed.xml',
  ])('GET %s returns 200', async (path) => {
    const response = await fetch(`${BASE_URL}${path}`);
    expect(response.status).toBe(200);
  });
});
