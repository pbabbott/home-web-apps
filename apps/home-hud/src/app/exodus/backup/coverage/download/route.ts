const HOMELAB_API_URL = process.env.HOMELAB_API_URL ?? 'http://localhost:4003';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pass-through to the full coverage report as a JSON download, so the browser
 * never talks to homelab-api directly. Only uuids are accepted, so it cannot
 * be used to reach other API routes.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get('sourceId') ?? '';
  const destinationId = searchParams.get('destinationId') ?? '';

  if (!UUID.test(sourceId) || !UUID.test(destinationId)) {
    return Response.json(
      { message: 'sourceId and destinationId are required' },
      { status: 400 },
    );
  }

  let upstream: Response;

  try {
    upstream = await fetch(
      `${HOMELAB_API_URL}/sources/${sourceId}/backup-coverage?${new URLSearchParams({ destinationId, format: 'json' })}`,
      { cache: 'no-store', signal: req.signal },
    );
  } catch {
    return Response.json(
      { message: 'Could not reach homelab-api' },
      { status: 502 },
    );
  }

  const headers = new Headers();

  for (const name of ['content-type', 'content-disposition', 'cache-control']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}
