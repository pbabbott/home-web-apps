import {
  isPathKnownToSource,
  listSkippedGroupPatterns,
  DiscoveryError,
} from '@abbottland/homelab-db';
import { Readable } from 'node:stream';
import { db } from '../../db';
import {
  ConnectionError,
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
import { ancestorsOf, loadTarget, withKeyErrors } from './source-connections';

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
