import { db } from '../../src/db';
import { getRequest } from '../jest.integration.setup';

// Runs against the real local dev Postgres; sources cascade to their
// connections, and audit events (no foreign keys) are removed explicitly.
const createdSourceIds: string[] = [];
const originalKey = process.env.EXODUS_CREDENTIAL_KEY;

beforeAll(() => {
  process.env.EXODUS_CREDENTIAL_KEY = Buffer.alloc(32, 3).toString('base64');
});

afterAll(() => {
  if (originalKey === undefined) delete process.env.EXODUS_CREDENTIAL_KEY;
  else process.env.EXODUS_CREDENTIAL_KEY = originalKey;
});

afterEach(async () => {
  await db.$client.query('delete from audit_events where source_id = any($1)', [
    createdSourceIds,
  ]);
  await db.$client.query('delete from sources where id = any($1)', [
    createdSourceIds,
  ]);
  createdSourceIds.length = 0;
});

const createSource = async (): Promise<string> => {
  const res = await getRequest()
    .post('/sources')
    .send({ name: `exodus-conn-${Math.random().toString(36).slice(2)}` })
    .expect(201);
  createdSourceIds.push(res.body.id);

  return res.body.id;
};

const body = {
  connectionType: 'smb',
  username: 'pabbott',
  password: 'correct horse battery staple',
  settings: { shareMappings: [{ pathPrefix: 'C:\\Users', share: 'Users' }] },
};

describe('source connections', () => {
  it('stores the password encrypted and never returns it', async () => {
    const id = await createSource();

    const saved = await getRequest()
      .put(`/sources/${id}/connection`)
      .send(body)
      .expect(200);
    const fetched = await getRequest()
      .get(`/sources/${id}/connection`)
      .expect(200);

    for (const res of [saved, fetched]) {
      expect(res.body).toMatchObject({
        username: 'pabbott',
        hasPassword: true,
        settings: body.settings,
      });
      expect(JSON.stringify(res.body)).not.toContain(body.password);
      expect(res.body).not.toHaveProperty('secretCiphertext');
    }

    const { rows } = await db.$client.query(
      'select secret_ciphertext from source_connections where source_id = $1',
      [id],
    );

    expect(rows[0].secret_ciphertext).toMatch(/^v1:/);
    expect(rows[0].secret_ciphertext).not.toContain('correct horse');
  });

  it('keeps the stored password when an edit omits it, and audits without the secret', async () => {
    const id = await createSource();
    await getRequest().put(`/sources/${id}/connection`).send(body).expect(200);
    const before = await db.$client.query(
      'select secret_ciphertext from source_connections where source_id = $1',
      [id],
    );

    await getRequest()
      .put(`/sources/${id}/connection`)
      .send({ connectionType: 'smb', username: 'someone-else' })
      .expect(200);

    const after = await db.$client.query(
      'select username, secret_ciphertext from source_connections where source_id = $1',
      [id],
    );
    expect(after.rows[0].username).toBe('someone-else');
    expect(after.rows[0].secret_ciphertext).toBe(
      before.rows[0].secret_ciphertext,
    );

    const events = await db.$client.query(
      'select event_type, details from audit_events where source_id = $1 order by created_at',
      [id],
    );
    expect(events.rows.map((r) => r.event_type)).toEqual([
      'source_connection.updated',
      'source_connection.updated',
    ]);
    expect(JSON.stringify(events.rows)).not.toContain('correct horse');
    expect(events.rows[1].details.passwordChanged).toBe(false);
  });

  it('requires a password to create', async () => {
    const id = await createSource();

    await getRequest()
      .put(`/sources/${id}/connection`)
      .send({ connectionType: 'smb', username: 'pabbott' })
      .expect(409);
  });

  it('deletes with the source and on request', async () => {
    const id = await createSource();
    await getRequest().put(`/sources/${id}/connection`).send(body).expect(200);

    await getRequest().delete(`/sources/${id}/connection`).expect(204);
    await getRequest().get(`/sources/${id}/connection`).expect(404);
    await getRequest().delete(`/sources/${id}/connection`).expect(404);

    await getRequest().put(`/sources/${id}/connection`).send(body).expect(200);
    await db.$client.query('delete from sources where id = $1', [id]);
    const { rowCount } = await db.$client.query(
      'select 1 from source_connections where source_id = $1',
      [id],
    );
    expect(rowCount).toBe(0);
  });

  describe('preview guards', () => {
    const preview = (id: string, path: string) =>
      getRequest().get(`/sources/${id}/preview`).query({ path });

    it('refuses types that cannot be previewed before anything else', async () => {
      const id = await createSource();

      await preview(id, 'C:\\a\\logo.svg').expect(415);
    });

    it('refuses a path discovery never recorded for the source', async () => {
      const id = await createSource();
      await getRequest()
        .put(`/sources/${id}/connection`)
        .send(body)
        .expect(200);

      const res = await preview(id, 'C:\\Windows\\win.ini').expect(403);

      expect(res.body.message).toContain('not part of');
    });
  });
});
