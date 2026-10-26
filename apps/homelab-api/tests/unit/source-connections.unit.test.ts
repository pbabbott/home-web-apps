import supertest from 'supertest';
import { createServer } from '../../src/server';
import * as service from '../../src/services/discovery';
import { HttpError } from '../../src/lib/http-error';

jest.mock('../../src/services/discovery', () => {
  const actual = jest.requireActual('../../src/services/discovery');

  return {
    DiscoveryError: actual.DiscoveryError,
    getConnection: jest.fn(),
    saveConnection: jest.fn(),
    deleteConnection: jest.fn(),
    testConnection: jest.fn(),
    openPreview: jest.fn(),
    getDirectoryListing: jest.fn(),
  };
});

const mocked = jest.mocked(service);
const ID = '123e4567-e89b-12d3-a456-426614174000';
const view = {
  sourceId: ID,
  connectionType: 'smb',
  username: 'pabbott',
  domain: null,
  settings: {},
  hasPassword: true,
};

describe('source connection routes', () => {
  afterEach(() => jest.resetAllMocks());

  it('PUT passes the body and actor through and never echoes a password', async () => {
    mocked.saveConnection.mockResolvedValue(view as never);

    const res = await supertest(createServer())
      .put(`/sources/${ID}/connection`)
      .send({ connectionType: 'smb', username: 'pabbott', password: 'pw' })
      .expect(200);

    expect(mocked.saveConnection).toHaveBeenCalledWith(
      ID,
      { connectionType: 'smb', username: 'pabbott', password: 'pw' },
      { type: 'human', id: null },
    );
    expect(JSON.stringify(res.body)).not.toContain('pw"');
    expect(res.body).not.toHaveProperty('password');
  });

  it('PUT rejects an unknown connection type and bad share names', async () => {
    const server = createServer();

    await supertest(server)
      .put(`/sources/${ID}/connection`)
      .send({ connectionType: 'ftp', username: 'u' })
      .expect(400);
    await supertest(server)
      .put(`/sources/${ID}/connection`)
      .send({
        connectionType: 'smb',
        username: 'u',
        settings: { shareMappings: [{ pathPrefix: 'C:\\', share: 'a;b' }] },
      })
      .expect(400);
  });

  it('answers 503 when the credential key is missing', async () => {
    mocked.saveConnection.mockRejectedValue(
      new HttpError(503, 'EXODUS_CREDENTIAL_KEY is not configured'),
    );

    const res = await supertest(createServer())
      .put(`/sources/${ID}/connection`)
      .send({ connectionType: 'smb', username: 'u', password: 'p' })
      .expect(503);

    expect(res.body.message).toContain('EXODUS_CREDENTIAL_KEY');
  });

  it('DELETE answers 204', async () => {
    mocked.deleteConnection.mockResolvedValue();
    await supertest(createServer())
      .delete(`/sources/${ID}/connection`)
      .expect(204);
  });

  it('POST test returns the recorded result', async () => {
    mocked.testConnection.mockResolvedValue({
      ...view,
      lastTestOk: false,
      lastTestError: 'Login failed',
    } as never);

    const res = await supertest(createServer())
      .post(`/sources/${ID}/connection/test`)
      .expect(200);

    expect(res.body.lastTestOk).toBe(false);
  });

  describe('GET /sources/:id/preview', () => {
    it('requires a path', async () => {
      await supertest(createServer()).get(`/sources/${ID}/preview`).expect(400);
    });

    it('sends text with safe headers, and the truncation flag', async () => {
      mocked.openPreview.mockResolvedValue({
        type: {
          kind: 'text',
          contentType: 'text/plain; charset=utf-8',
          maxBytes: 1,
        },
        size: 99,
        truncated: true,
        body: Buffer.from('<a/>'),
      });

      const res = await supertest(createServer())
        .get(`/sources/${ID}/preview`)
        .query({ path: 'C:\\a\\x.xml' })
        .expect(200);

      expect(res.text).toBe('<a/>');
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBe('sandbox');
      expect(res.headers['x-preview-truncated']).toBe('true');
      expect(mocked.openPreview).toHaveBeenCalledWith(ID, 'C:\\a\\x.xml');
    });

    it.each([403, 413, 415, 502])('passes %s through', async (status) => {
      mocked.openPreview.mockRejectedValue(
        new HttpError(status as 403, 'nope'),
      );

      await supertest(createServer())
        .get(`/sources/${ID}/preview`)
        .query({ path: 'C:\\a\\x.jpg' })
        .expect(status);
    });
  });
});

describe('directory listing route', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns the listing with coverage', async () => {
    const listing = {
      path: 'C:\\Users\\You',
      total: 1,
      truncated: false,
      uncovered: 1,
      entries: [
        {
          name: 'a.txt',
          path: 'C:\\Users\\You\\a.txt',
          isDirectory: false,
          size: 1,
          modifiedAt: null,
          coverage: { kind: 'uncovered' },
        },
      ],
    };
    mocked.getDirectoryListing.mockResolvedValue(listing as never);

    const res = await supertest(createServer())
      .get(`/queue-items/${ID}/directory-listing`)
      .expect(200);

    expect(res.body).toEqual(listing);
    expect(mocked.getDirectoryListing).toHaveBeenCalledWith(ID);
  });

  it('maps a connection failure to its status', async () => {
    mocked.getDirectoryListing.mockRejectedValue(
      new HttpError(502, 'Could not reach the machine over SMB'),
    );

    const res = await supertest(createServer())
      .get(`/queue-items/${ID}/directory-listing`)
      .expect(502);

    expect(res.body).toEqual({
      message: 'Could not reach the machine over SMB',
    });
  });

  it('rejects an id that is not a uuid', async () => {
    await supertest(createServer())
      .get('/queue-items/nope/directory-listing')
      .expect(400);
  });
});
