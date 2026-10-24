import {
  deleteSourceConnection as deleteConnectionRow,
  getHostById,
  getSourceById,
  getSourceConnection,
  isPathKnownToSource,
  recordSourceConnectionTest,
  upsertSourceConnection,
  DiscoveryError,
  type Actor,
  type SourceConnection,
} from '@abbottland/homelab-db';
import { Readable } from 'node:stream';
import { db } from '../../db';
import {
  ConnectionError,
  getConnectionDriver,
  type ConnectionTarget,
} from '../../lib/connections';
import { HttpError } from '../../lib/http-error';
import { previewTypeOf, type PreviewType } from '../../lib/preview-types';
import {
  CredentialKeyError,
  decryptSecret,
  encryptSecret,
} from '../../lib/secret-box';
import {
  normalizeWindowsPath,
  windowsPathParent,
} from '../../lib/windows-path';
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
const withKeyErrors = async <T>(fn: () => Promise<T>): Promise<T> => {
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
const loadTarget = async (
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
    target: {
      address: host.ipAddress,
      hostNames: [host.ipAddress, host.name],
      username: connection.username,
      domain: connection.domain,
      password: decryptSecret(connection.secretCiphertext),
      settings: connection.settings,
    },
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

export type Preview = {
  type: PreviewType;
  size: number;
  /** Set when a text file was cut at the size limit. */
  truncated: boolean;
  /** The file's bytes (text is decoded to UTF-8 and capped). */
  body: Readable | Buffer;
};

const ancestorsOf = (normalizedPath: string): string[] => {
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

const readUpTo = async (stream: Readable, limit: number): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
    total += (chunk as Buffer).length;

    if (total >= limit) {
      stream.destroy();
      break;
    }
  }

  return Buffer.concat(chunks).subarray(0, limit);
};

/** Windows tools often write UTF-16; show it as readable text. */
export const decodeText = (bytes: Buffer): Buffer => {
  const utf16le =
    (bytes[0] === 0xff && bytes[1] === 0xfe) ||
    (bytes.length > 3 && bytes[1] === 0 && bytes[3] === 0);

  if (utf16le) {
    return Buffer.from(bytes.toString('utf16le').replace(/^\uFEFF/, ''));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return Buffer.from(
      Buffer.from(bytes).swap16().toString('utf16le').slice(1),
    );
  }

  return Buffer.from(bytes.toString('utf8').replace(/^\uFEFF/, ''));
};

/**
 * Opens one file of a source for preview. Limited to paths discovery has
 * recorded for the source (an inventory item's folder or file, or a skipped
 * path) and to previewable types, so the endpoint cannot be used to read
 * arbitrary files from the machine.
 */
export const openPreview = (sourceId: string, path: string): Promise<Preview> =>
  withKeyErrors(async () => {
    const { normalizedPath, path: canonical } = (() => {
      try {
        return normalizeWindowsPath(path);
      } catch (err) {
        throw new DiscoveryError(
          'conflict',
          err instanceof Error ? err.message : 'invalid path',
        );
      }
    })();

    const type = previewTypeOf(canonical);

    if (!type) {
      throw new HttpError(415, 'This file type cannot be previewed');
    }

    if (
      !(await isPathKnownToSource(db, sourceId, ancestorsOf(normalizedPath)))
    ) {
      throw new HttpError(
        403,
        'This path is not part of the source\u2019s inventory or skipped paths',
      );
    }

    const { connection, target } = await loadTarget(sourceId);
    const driver = getConnectionDriver(connection.connectionType);

    try {
      const { size } = await driver.stat(target, canonical);

      if (type.kind !== 'text' && size > type.maxBytes) {
        throw new HttpError(
          413,
          `File is ${(size / 1024 / 1024).toFixed(1)} MB; previews are limited to ${type.maxBytes / 1024 / 1024} MB`,
        );
      }

      const stream = driver.open(target, canonical);

      if (type.kind !== 'text') {
        return { type, size, truncated: false, body: stream };
      }

      return {
        type,
        size,
        truncated: size > type.maxBytes,
        body: decodeText(await readUpTo(stream, type.maxBytes)),
      };
    } catch (err) {
      if (err instanceof ConnectionError) {
        if (err.code === 'not_found') {
          throw new DiscoveryError('not_found', err.message);
        }
        throw new HttpError(502, err.message);
      }
      throw err;
    }
  });
