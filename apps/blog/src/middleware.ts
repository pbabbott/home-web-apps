import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BOT_PATTERN =
  /bot|spider|crawl|slurp|mediapartners-google|facebookexternalhit|twitterbot|linkedinbot|pinterest|whatsapp|prerender|headlesschrome|puppeteer|playwright|lighthouse/i;

export function middleware(request: NextRequest) {
  if (request.cookies.get('is-bot')?.value === '1') return NextResponse.next();

  const ua = request.headers.get('user-agent') ?? '';
  const bot = process.env.NODE_ENV !== 'development' && BOT_PATTERN.test(ua);
  const response = NextResponse.next();
  response.cookies.set('is-bot', bot ? '1' : '0', {
    httpOnly: false,
    sameSite: 'strict',
    path: '/',
  });
  return response;
}

export const config = {
  matcher: '/',
};
