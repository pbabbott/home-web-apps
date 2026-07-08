import { NextResponse } from 'next/server';

const UMAMI_SCRIPT_URL = 'https://analytics.abbottland.io/script.js';

// Read at request time (not build time) so the same image can be deployed to
// preview and production with different ENABLE_ANALYTICS values.
export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.ENABLE_ANALYTICS !== 'true') {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.redirect(UMAMI_SCRIPT_URL, 307);
}
