import { errorMessage } from '../errors';

export const HOMELAB_API_URL =
  process.env.HOMELAB_API_URL ?? 'http://localhost:4003';

/**
 * Actions return a result instead of throwing: Next.js redacts the message
 * of an error thrown from a server action in production builds, and these
 * messages are meant to be shown to the user.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function send<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<ActionResult<T>> {
  try {
    const res = await fetch(`${HOMELAB_API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) return { ok: false, error: await errorMessage(res) };

    // 204: nothing to parse.
    if (res.status === 204) return { ok: true, data: undefined as T };

    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    console.error(`${method} ${path} failed:`, err);
    return { ok: false, error: 'Could not reach homelab-api' };
  }
}

export const post = <T>(path: string, body?: unknown) =>
  send<T>('POST', path, body);
export const put = <T>(path: string, body?: unknown) =>
  send<T>('PUT', path, body);
export const patch = <T>(path: string, body?: unknown) =>
  send<T>('PATCH', path, body);
