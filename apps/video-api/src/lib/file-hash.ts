import crypto from 'crypto';
import fs from 'fs';

/**
 * Streams the full file at `absPath` through SHA-256. Used as the
 * rename-proof identity for a video file: source filenames in this library
 * routinely don't match episode titles, so paths alone can't be trusted to
 * stay pointed at the same content.
 */
export const hashFile = (absPath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(absPath);

    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
