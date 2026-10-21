export const HOMELAB_API_URL =
  process.env.HOMELAB_API_URL ?? 'http://localhost:4003';

/** Browser-reachable address, for links; `HOMELAB_API_URL` may be cluster-internal. */
export const HOMELAB_API_PUBLIC_URL =
  process.env.HOMELAB_API_PUBLIC_URL ?? HOMELAB_API_URL;
