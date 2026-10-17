'use server';

import type { PodCpuMetrics, PodMemoryMetrics } from './homelab-api';

const HOMELAB_API_URL = process.env.HOMELAB_API_URL ?? 'http://localhost:4003';

/**
 * Client-invoked (selection happens via local state, not the URL, so this
 * can't be a server-component page fetch like `getPodMap`). Best-effort —
 * `null` on a missing pod (404), since this backs an optional detail-panel
 * chart, not a critical read.
 */
export async function getPodCpuMetrics(
  namespace: string,
  pod: string,
): Promise<PodCpuMetrics | null> {
  const res = await fetch(
    `${HOMELAB_API_URL}/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(pod)}/metrics/cpu`,
    { cache: 'no-store' },
  );

  if (res.status === 404) return null;

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /pods/${namespace}/${pod}/metrics/cpu returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as PodCpuMetrics;
}

/** Same contract as {@link getPodCpuMetrics}, for memory. */
export async function getPodMemoryMetrics(
  namespace: string,
  pod: string,
): Promise<PodMemoryMetrics | null> {
  const res = await fetch(
    `${HOMELAB_API_URL}/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(pod)}/metrics/memory`,
    { cache: 'no-store' },
  );

  if (res.status === 404) return null;

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /pods/${namespace}/${pod}/metrics/memory returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as PodMemoryMetrics;
}
