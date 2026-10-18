import { HOMELAB_API_URL } from './config';

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${HOMELAB_API_URL}${path}`, { cache: 'no-store' });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`homelab-api GET ${path} returned ${res.status}: ${body}`);
  }

  return (await res.json()) as T;
}
