import supertest from 'supertest';
import { createServer, DOCS_ROUTE, OPENAPI_ROUTE } from '../../src/server';

jest.mock('../../src/services/pod-map', () => ({
  buildPodMap: jest.fn().mockResolvedValue({
    mapType: 'pods',
    metric: 'cpu',
    items: [],
    groups: null,
  }),
}));

describe('GET /healthz', () => {
  it('status check returns 200', async () => {
    await supertest(createServer())
      .get('/healthz')
      .expect(200)
      .then((res) => {
        expect(res.body.status).toBe('ok');
      });
  });
});

describe('GET /docs', () => {
  it('serves the Swagger UI', async () => {
    await supertest(createServer())
      .get(`${DOCS_ROUTE}/`)
      .expect(200)
      .then((res) => {
        expect(res.text).toContain('swagger-ui');
      });
  });
});

describe('GET /openapi.json', () => {
  it('serves the spec, tagging operations that have an MCP tool', async () => {
    const res = await supertest(createServer()).get(OPENAPI_ROUTE).expect(200);

    expect(
      res.body.paths['/discovery-jobs/{id}/queue-items/claim'].post[
        'x-mcp-tool'
      ],
    ).toBe('claim_directory');
    expect(
      res.body.paths['/inventory-items/{id}/decision'].patch['x-home-hud'],
    ).toBe('/exodus/inventory');
    expect(
      res.body.paths['/discovery-jobs/{id}/queue-items'].post['x-home-hud'],
    ).toBeUndefined();
    expect(
      res.body.paths['/inventory-items/{id}/decision'].patch['x-mcp-tool'],
    ).toBeUndefined();
  });

  it('tags every operation with its domain so Swagger UI can group them', async () => {
    const res = await supertest(createServer()).get(OPENAPI_ROUTE).expect(200);

    const untagged = Object.entries(res.body.paths).flatMap(([path, item]) =>
      Object.entries(item as Record<string, { tags?: string[] }>)
        .filter(([, operation]) => !operation.tags?.length)
        .map(([method]) => `${method} ${path}`),
    );

    expect(untagged).toEqual([]);
    expect(res.body.paths['/sources/{id}/discovery-jobs'].post.tags).toEqual([
      'Discovery Jobs',
    ]);
    expect(res.body.paths['/sources/{id}/known-skips'].get.tags).toEqual([
      'Queue Items',
    ]);
  });
});
