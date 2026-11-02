import {
  deleteSourceConnection as deleteConnectionRow,
  getHostById,
  getSourceById,
  getSourceConnection,
  recordSourceConnectionTest,
  upsertSourceConnection,
  DiscoveryError,
  type Actor,
  type SourceConnection,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import {
  buildConnectionTarget,
  CredentialKeyError,
  encryptSecret,
  getConnectionDriver,
  windowsPathParent,
  type ConnectionTarget,
} from '@abbottland/source-access';
import { HttpError } from '../../lib/http-error';
import type { SaveSourceConnectionBody } from '../../schemas/discovery';

/** A connection as the API returns it: everything but the secret. */
export type SourceConnectionView = Omit<
  SourceConnection,
  'secretCiphertext'
> & { hasPassword: true };

const toView = (row: SourceConnection): SourceConnectionView => {
  const view: Partial<SourceConnection> = { ...row };

  delete view.secretCiphertext;

  return {
    ...(view as Omit<SourceConnection, 'secretCiphertext'>),
    hasPassword: true,
  };
};

/** A missing key is a deployment gap, not a client mistake. */
export const withKeyErrors = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof CredentialKeyError) {
      throw new HttpError(503, err.message);
    }
    throw err;
  }
};

export const getConnection = async (
  sourceId: string,
): Promise<SourceConnectionView> => {
  const row = await getSourceConnection(db, sourceId);

  if (!row) throw new DiscoveryError('not_found', 'connection not found');

  return toView(row);
};

export const saveConnection = (
  sourceId: string,
  body: SaveSourceConnectionBody,
  actor: Actor,
): Promise<SourceConnectionView> =>
  withKeyErrors(async () =>
    toView(
      await upsertSourceConnection(db, {
        sourceId,
        connectionType: body.connectionType,
        username: body.username,
        domain: body.domain ?? null,
        secretCiphertext:
          body.password === undefined
            ? undefined
            : encryptSecret(body.password),
        settings: body.settings,
        actor,
      }),
    ),
  );

export const deleteConnection = (
  sourceId: string,
  actor: Actor,
): Promise<void> => deleteConnectionRow(db, sourceId, actor);

/** Everything needed to talk to a source: its connection (decrypted) and host. */
export const loadTarget = async (
  sourceId: string,
): Promise<{ connection: SourceConnection; target: ConnectionTarget }> => {
  const source = await getSourceById(db, sourceId);

  if (!source) throw new DiscoveryError('not_found', 'source not found');

  const connection = await getSourceConnection(db, sourceId);

  if (!connection) {
    throw new DiscoveryError(
      'not_found',
      'This source has no connection configured. Add one by editing the source.',
    );
  }

  const host = source.hostId ? await getHostById(db, source.hostId) : undefined;

  if (!host) {
    throw new DiscoveryError(
      'conflict',
      'This source is not linked to a host, so its address is unknown.',
    );
  }

  return {
    connection,
    target: buildConnectionTarget(connection, host),
  };
};

export const testConnection = (
  sourceId: string,
): Promise<SourceConnectionView> =>
  withKeyErrors(async () => {
    const { connection, target } = await loadTarget(sourceId);
    const result = await getConnectionDriver(connection.connectionType).test(
      target,
    );

    return toView(await recordSourceConnectionTest(db, sourceId, result));
  });

export const ancestorsOf = (normalizedPath: string): string[] => {
  const paths = [normalizedPath];

  for (
    let parent = windowsPathParent(normalizedPath);
    parent;
    parent = windowsPathParent(parent)
  ) {
    paths.push(parent);
  }

  return paths;
};
