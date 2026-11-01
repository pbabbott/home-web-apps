import { spawn } from 'node:child_process';
import { ConnectionError, type ConnectionTarget } from './types';

export const TIMEOUT_MS = 30_000;

/** Turns smbclient output into a message a person can act on. */
export const describeSmbError = (output: string): string => {
  const status = /NT_STATUS_[A-Z_]+/.exec(output)?.[0];

  switch (status) {
    case 'NT_STATUS_LOGON_FAILURE':
      return 'Login failed: wrong username or password';
    case 'NT_STATUS_ACCOUNT_LOCKED_OUT':
      return 'The account is locked out';
    case 'NT_STATUS_ACCESS_DENIED':
      return 'Access denied (for a local account the share may need to be shared with this user)';
    case 'NT_STATUS_BAD_NETWORK_NAME':
      return 'The share does not exist on that machine';
    case 'NT_STATUS_OBJECT_NAME_NOT_FOUND':
    case 'NT_STATUS_OBJECT_PATH_NOT_FOUND':
      return 'File not found on the source';
    case 'NT_STATUS_HOST_UNREACHABLE':
    case 'NT_STATUS_IO_TIMEOUT':
    case 'NT_STATUS_CONNECTION_REFUSED':
    case 'NT_STATUS_UNSUCCESSFUL':
      return 'Could not reach the machine over SMB';
    default:
      return status ?? (output.trim().split('\n')[0] || 'smbclient failed');
  }
};

/**
 * The password goes in the child's environment (`PASSWD`), never argv, which
 * any local user can read from the process list. The rest of the caller's
 * environment (database password, etc.) is not passed on.
 */
export const smbclientInvocation = (
  target: ConnectionTarget,
  args: string[],
): { args: string[]; env: NodeJS.ProcessEnv } => ({
  args: [
    ...args,
    '-U',
    target.domain ? `${target.domain}\\${target.username}` : target.username,
    '-m',
    'SMB3',
  ],
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    PASSWD: target.password,
    // allinfo and ls print times in the client's zone; UTC makes them absolute.
    TZ: 'UTC',
  },
});

/** `timeoutMs` null: the caller watches for stalls itself (long transfers). */
export const spawnSmbclient = (
  target: ConnectionTarget,
  args: string[],
  timeoutMs: number | null = TIMEOUT_MS,
) => {
  const invocation = smbclientInvocation(target, args);
  const child = spawn('smbclient', invocation.args, {
    env: invocation.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const timer =
    timeoutMs === null
      ? undefined
      : setTimeout(() => child.kill('SIGKILL'), timeoutMs);

  child.on('close', () => clearTimeout(timer));

  return child;
};

export const runSmbclient = (
  target: ConnectionTarget,
  args: string[],
): Promise<{ output: string; code: number | null }> =>
  new Promise((resolve, reject) => {
    const child = spawnSmbclient(target, args);
    let output = '';

    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('error', (err) =>
      reject(
        new ConnectionError(
          'failed',
          (err as NodeJS.ErrnoException).code === 'ENOENT'
            ? 'smbclient is not installed on the API host'
            : err.message,
        ),
      ),
    );
    child.on('close', (code) => resolve({ output, code }));
  });

export const toConnectionError = (err: unknown): ConnectionError =>
  err instanceof ConnectionError
    ? err
    : new ConnectionError(
        'failed',
        err instanceof Error ? err.message : String(err),
      );
