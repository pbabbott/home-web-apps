const HOMELAB_API_URL = process.env.HOMELAB_API_URL ?? 'http://localhost:4003';

// Streams a file; must not be statically optimized or run on the edge runtime.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Response headers worth keeping; the rest describe the hop to this server. */
const FORWARDED_HEADERS = [
  'content-type',
  'content-length',
  'content-disposition',
  'content-security-policy',
  'x-content-type-options',
  'x-preview-truncated',
  'cache-control',
];

/**
 * Pass-through to homelab-api's file preview, so the browser never talks to
 * homelab-api directly (it stays internal-only). The API decides what may be
 * read; this only checks the source id is a uuid so it cannot be used to
 * reach other API routes.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get('sourceId') ?? '';
  const path = searchParams.get('path') ?? '';

  if (!UUID.test(sourceId) || !path) {
    return Response.json(
      { message: 'sourceId and path are required' },
      { status: 400 },
    );
  }

  let upstream: Response;

  try {
    upstream = await fetch(
      `${HOMELAB_API_URL}/sources/${sourceId}/preview?path=${encodeURIComponent(path)}`,
      { cache: 'no-store', signal: req.signal },
    );
  } catch {
    return Response.json(
      { message: 'Could not reach homelab-api' },
      { status: 502 },
    );
  }

  const headers = new Headers();

  for (const name of FORWARDED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}
