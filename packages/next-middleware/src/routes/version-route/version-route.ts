import { NextResponse } from 'next/server';
import { parseImageInfo } from '../../image-info/parse-image-info';

/**
 * Reports what this pod is running. Reads the env at request time (bracket
 * access so no bundler inlines it at build time) and must be served from a
 * `force-dynamic` route in the app:
 *
 *   export const dynamic = 'force-dynamic';
 *   export const GET = versionRoute;
 */
export const versionRoute = async () => {
  return NextResponse.json(
    parseImageInfo(process.env['IMAGE_TAG'], process.env['PR_NUMBER']),
    { headers: { 'Cache-Control': 'no-store' } },
  );
};
