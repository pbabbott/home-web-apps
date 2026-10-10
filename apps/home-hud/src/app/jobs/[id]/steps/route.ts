const VIDEO_API_URL = process.env.VIDEO_API_URL ?? 'http://localhost:4002';

// A long-lived streaming response — must not be statically optimized or
// run on the edge runtime, either of which would buffer/break the stream.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * Transparent SSE proxy: the browser never talks to video-api directly
 * (keeps it as internal-only as every other request today). This just
 * pipes video-api's stream straight through — no SSE parsing/re-encoding.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const upstream = await fetch(`${VIDEO_API_URL}/jobs/${id}/steps/stream`, {
    cache: 'no-store',
  });

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
