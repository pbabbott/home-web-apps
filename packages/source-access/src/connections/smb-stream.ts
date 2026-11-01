import { PassThrough, type Readable } from 'node:stream';
import { errorCodeOf } from './smb-parse';
import { describeSmbError, spawnSmbclient } from './smb-process';
import {
  ConnectionError,
  type ConnectionTarget,
  type OpenStreamOptions,
} from './types';

const TAIL_BYTES = 512;

/**
 * Streams the output of one `get ... -`. With `-` smbclient prints errors on
 * **stdout**, in the middle of the data, and exits 1, so the exit code is the
 * only trustworthy signal: a non-zero exit destroys the stream with a
 * ConnectionError, and a consumer must not treat bytes seen before that as
 * the file. Exit 0 with fewer bytes than the file has can still happen, hence
 * the caller compares counts. Stalls count only while the consumer keeps up
 * (a full buffer is the consumer's wait, not the source's).
 */
export const streamGet = (
  target: ConnectionTarget,
  share: string,
  command: string,
  options: OpenStreamOptions,
): Readable => {
  const child = spawnSmbclient(
    target,
    [`//${target.address}/${share}`, '-c', command],
    null,
  );
  const out = new PassThrough();
  let tail = '';
  let settled = false;
  let timer: NodeJS.Timeout | undefined;

  const settle = (err?: Error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
    if (err) {
      child.kill('SIGKILL');
      out.destroy(err);
    } else {
      out.end();
    }
  };
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (out.writableNeedDrain) return arm();
      settle(
        new ConnectionError(
          'stalled',
          `no data from the source for ${Math.round(options.stallTimeoutMs / 1000)} s`,
        ),
      );
    }, options.stallTimeoutMs);
  };
  const onAbort = () =>
    settle(
      options.signal?.reason instanceof Error
        ? options.signal.reason
        : new Error('transfer aborted'),
    );

  if (options.signal?.aborted) {
    onAbort();

    return out;
  }
  options.signal?.addEventListener('abort', onAbort, { once: true });
  out.on('drain', arm);
  out.on('close', () => {
    // The consumer stopped reading (or settle destroyed us): end the transfer.
    clearTimeout(timer);
    if (!settled) settled = true;
    child.kill('SIGKILL');
  });

  child.stdout.on('data', (chunk: Buffer) => {
    arm();
    tail = (tail + chunk.toString('latin1')).slice(-TAIL_BYTES);
  });
  child.stdout.pipe(out, { end: false });
  child.stderr.on('data', (chunk: Buffer) => {
    tail = (tail + chunk.toString('latin1')).slice(-TAIL_BYTES);
  });
  child.on('error', (err) =>
    settle(
      new ConnectionError(
        'failed',
        (err as NodeJS.ErrnoException).code === 'ENOENT'
          ? 'smbclient is not installed on this host'
          : err.message,
      ),
    ),
  );
  child.on('close', (code) =>
    settle(
      code === 0
        ? undefined
        : new ConnectionError(errorCodeOf(tail), describeSmbError(tail)),
    ),
  );
  arm();

  return out;
};
