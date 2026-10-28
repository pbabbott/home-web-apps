import {
  deleteSourceConnection as deleteConnectionRow,
  getDiscoveryJobById,
  getHostById,
  findNestedInventoryItems,
  listAcknowledgedSkipKeys,
  getQueueItemById,
  getSourceById,
  getSourceConnection,
  isPathKnownToSource,
  listExclusionRules,
  listInventoryUnder,
  listJobQueueStatusesAt,
  listSkippedGroupPatterns,
  recordSourceConnectionTest,
  resolveExclusion,
  upsertSourceConnection,
  DiscoveryError,
  type Actor,
  type SourceConnection,
} from '@abbottland/homelab-db';
import { Readable } from 'node:stream';
import { db } from '../../db';
import {
  buildConnectionTarget,
  ConnectionError,
  CredentialKeyError,
  encryptSecret,
  getConnectionDriver,
  normalizeWindowsPath,
  windowsPathParent,
  type ConnectionTarget,
} from '@abbottland/source-access';
import { HttpError } from '../../lib/http-error';
import { matchesNamePattern } from '../../lib/name-pattern';
import { previewTypeOf, type PreviewType } from '../../lib/preview-types';
import {
  EOCD_SEARCH_BYTES,
  locateCentralDirectory,
  parseCentralDirectory,
  type ZipEntry,
} from '../../lib/zip-listing';
import type { SaveSourceConnectionBody } from '../../schemas/discovery';
import { childOf, classifyEntries, type DiskEntry } from './disk-coverage';
import { reviewSkips } from './skip-review';

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

export type Preview = {
  type: PreviewType;
  size: number;
  /** Set when a text file was cut at the size limit. */
  truncated: boolean;
  /** The file's bytes (text is decoded to UTF-8 and capped; a zip is its JSON listing). */
  body: Readable | Buffer;
};

const MAX_ZIP_ENTRIES = 1000;

export type ZipListing = {
  /** Entries the archive declares, before the cap. */
  total: number;
  truncated: boolean;
  /** Uncompressed size of the listed entries. */
  totalSize: number;
  entries: ZipEntry[];
};

/** Lists a zip from its central directory, reading only the end of the file. */
const listZip = async (
  driver: ReturnType<typeof getConnectionDriver>,
  target: ConnectionTarget,
  path: string,
  size: number,
  maxDirectoryBytes: number,
): Promise<ZipListing> => {
  try {
    const tail = await driver.readTail(
      target,
      path,
      size,
      Math.min(size, EOCD_SEARCH_BYTES),
    );
    const directory = locateCentralDirectory(tail, size);

    if (directory.size > maxDirectoryBytes) {
      throw new HttpError(
        413,
        `This zip's file list is ${(directory.size / 1024 / 1024).toFixed(1)} MB; previews are limited to ${maxDirectoryBytes / 1024 / 1024} MB`,
      );
    }

    const bytes =
      directory.offset >= size - tail.length
        ? tail.subarray(directory.offset - (size - tail.length))
        : await driver.readTail(target, path, size, size - directory.offset);
    const entries = parseCentralDirectory(
      bytes.subarray(0, directory.size),
      directory.entries,
      MAX_ZIP_ENTRIES,
    );

    return {
      total: directory.entries,
      truncated: entries.length < directory.entries,
      totalSize: entries.reduce((sum, entry) => sum + entry.size, 0),
      entries,
    };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('not a readable zip')) {
      throw new HttpError(422, `Could not read the zip: ${err.message}`);
    }
    throw err;
  }
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

/** True if the file's name matches a pattern skipped directly under its folder. */
const matchesSkippedGroup = async (
  sourceId: string,
  canonical: string,
  normalizedPath: string,
): Promise<boolean> => {
  const parent = windowsPathParent(normalizedPath);

  if (!parent) return false;

  const name = canonical.slice(canonical.lastIndexOf('\\') + 1);
  const patterns = await listSkippedGroupPatterns(db, sourceId, parent);

  return patterns.some((pattern) => matchesNamePattern(pattern, name));
};

/**
 * Opens one file of a source for preview. Limited to paths discovery has
 * recorded for the source (an inventory item's folder or file, a skipped
 * path, or a file matching a skipped pattern of its folder) and to previewable types, so the endpoint cannot be used to read
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
      !(await isPathKnownToSource(db, sourceId, ancestorsOf(normalizedPath))) &&
      !(await matchesSkippedGroup(sourceId, canonical, normalizedPath))
    ) {
      throw new HttpError(
        403,
        'This path is not part of the source\u2019s inventory, skipped paths or skipped patterns',
      );
    }

    const { connection, target } = await loadTarget(sourceId);
    const driver = getConnectionDriver(connection.connectionType);

    try {
      const { size } = await driver.stat(target, canonical);

      if (type.kind === 'zip') {
        const listing = await listZip(
          driver,
          target,
          canonical,
          size,
          type.maxBytes,
        );

        return {
          type,
          size,
          truncated: false,
          body: Buffer.from(JSON.stringify(listing)),
        };
      }

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

const MAX_PATTERN_MATCHES = 1000;

export type SkippedGroupMatches = {
  path: string;
  pattern: string;
  /** Matches found, before the cap. */
  total: number;
  truncated: boolean;
  entries: {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    modifiedAt: string | null;
  }[];
};

/**
 * Lists the entries of a queue item's directory that one of its skipped
 * patterns matches, so a reviewer can see what the pattern excluded. Only a
 * pattern the worker recorded on the item is listed, so this cannot be used
 * to browse the machine.
 */
export const listSkippedGroupMatches = (
  queueItemId: string,
  pattern: string,
): Promise<SkippedGroupMatches> =>
  withKeyErrors(async () => {
    const item = await getQueueItemById(db, queueItemId);

    if (!item) throw new DiscoveryError('not_found', 'queue item not found');

    if (
      !item.result?.skippedGroups?.some((group) => group.pattern === pattern)
    ) {
      throw new HttpError(403, 'This pattern was not skipped for this item');
    }

    const job = await getDiscoveryJobById(db, item.jobId);

    if (!job) throw new DiscoveryError('not_found', 'job not found');

    const { connection, target } = await loadTarget(job.sourceId);

    try {
      const matches = (
        await getConnectionDriver(connection.connectionType).list(
          target,
          item.path,
        )
      )
        .filter((entry) => matchesNamePattern(pattern, entry.name))
        .sort((a, b) => a.name.localeCompare(b.name));
      const base = item.path.replace(/\\+$/, '');

      return {
        path: item.path,
        pattern,
        total: matches.length,
        truncated: matches.length > MAX_PATTERN_MATCHES,
        entries: matches.slice(0, MAX_PATTERN_MATCHES).map((entry) => ({
          ...entry,
          path: `${base}\\${entry.name}`,
        })),
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

const MAX_DISK_ENTRIES = 2000;

export type DirectoryListing = {
  path: string;
  /** Entries found, before the cap. */
  total: number;
  truncated: boolean;
  /** Entries nothing accounts for: no inventory item, skip, queue item or rule. */
  uncovered: number;
  entries: DiskEntry[];
};

/**
 * Lists the direct children of a queue item's directory over the source's
 * connection and says how each is accounted for (inventory item, skip, queue
 * item of its own, exclusion rule), so a reviewer can find what was missed.
 * Only the item's own directory is listed, so this cannot browse the machine.
 */
export const getDirectoryListing = (
  queueItemId: string,
): Promise<DirectoryListing> =>
  withKeyErrors(async () => {
    const item = await getQueueItemById(db, queueItemId);

    if (!item) throw new DiscoveryError('not_found', 'queue item not found');

    const job = await getDiscoveryJobById(db, item.jobId);

    if (!job) throw new DiscoveryError('not_found', 'job not found');

    const { connection, target } = await loadTarget(job.sourceId);

    try {
      const listed = (
        await getConnectionDriver(connection.connectionType).list(
          target,
          item.path,
        )
      ).sort((a, b) => a.name.localeCompare(b.name));
      const shown = listed.slice(0, MAX_DISK_ENTRIES);
      const normalizedDirectory = normalizeWindowsPath(
        item.path,
      ).normalizedPath;
      const [inventoryUnder, nested, queueStatuses, rules, acknowledged] =
        await Promise.all([
          listInventoryUnder(db, job.sourceId, normalizedDirectory),
          findNestedInventoryItems(
            db,
            job.sourceId,
            normalizedDirectory,
            ancestorsOf(normalizedDirectory),
          ),
          listJobQueueStatusesAt(
            db,
            job.id,
            shown.map((entry) => childOf(item.path, entry.name).normalizedPath),
          ),
          listExclusionRules(db, { sourceId: job.sourceId }),
          listAcknowledgedSkipKeys(db, job.sourceId, normalizedDirectory),
        ]);
      const { entries, uncovered } = classifyEntries({
        directory: item.path,
        entries: shown,
        inventoryUnder,
        coveredByInventoryParent: nested.coveredBy.length > 0,
        queueStatuses,
        isExcluded: (normalizedPath) =>
          resolveExclusion(rules, normalizedPath).state === 'excluded',
        result: item.result,
        skipReview: reviewSkips(item.path, item.result, {
          acknowledged: new Set(acknowledged),
          inventoried: new Set(inventoryUnder.map((i) => i.normalizedRootPath)),
        }),
      });

      return {
        path: item.path,
        total: listed.length,
        truncated: listed.length > MAX_DISK_ENTRIES,
        uncovered,
        entries,
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
