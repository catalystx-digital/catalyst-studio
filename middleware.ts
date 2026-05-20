import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_BYPASS_USER_HEADER,
  AUTH_SESSION_COOKIE,
  AUTHENTICATED_HEADER,
  verifySessionCookieEdge,
} from '@/lib/auth/session-cookie.edge';

const STATIC_BYPASS_PATTERNS = [
  /^\/_next\//,
  /^\/favicons?\//,
  /^\/robots\.txt$/,
  /^\/static\//,
  /^\/images\//,
  /^\/fonts\//,
  /^\/.well-known\/workflow\//,
  /^\/sandbox-template\.tar\.gz$/,
];
const PUBLIC_AUTH_PATHS = [/^\/sign-in(?:\/.*)?$/, /^\/sign-up(?:\/.*)?$/];
const API_ROUTE = /^\/(api|trpc)(.*)$/;
const PUBLIC_APP_PATHS = [/^\/$/, /^\/dashboard(?:\/)?$/, /^\/invite\/accept(?:\/)?$/];
const EXCLUDED_API_PATHS = [
  /^\/api\/sync\/status(?:\/.*)?$/,
  /^\/api\/sync\/history(?:\/.*)?$/,
  /^\/api\/dashboard\/import-activity(?:\/.*)?$/,
  /^\/api\/v1\/sync\/state(?:\/.*)?$/,
  /^\/api\/v1\/sync\/history(?:\/.*)?$/,
  /^\/api\/v1\/sync\/[^/]+\/status(?:\/.*)?$/,
  /^\/api\/studio\/ucs\/graphql$/,
];
const PUBLIC_API_PATHS = [
  /^\/api\/studio\/invitations\/lookup$/,
  /^\/api\/auth\/(?:sign-in|sign-up|sign-out|session)$/,
  /^\/api\/preview\/render$/,
  /^\/api\/preview\/sandbox(?:\/.*)?$/,
  /^\/api\/studio\/preview\/data$/,
  /^\/api\/internal\/import-job$/,
  /^\/api\/internal\/import-persist$/,
  /^\/api\/internal\/design-system$/,
  /^\/api\/internal\/greenfield-job$/,
  /^\/api\/internal\/greenfield-persist$/,
];

const HEADER_BYPASS_ENABLED =
  process.env.ALLOW_AUTH_HEADER_BYPASS === 'true' && process.env.NODE_ENV !== 'production';

function matchesAny(pathname: string, patterns: RegExp[]): boolean {
  return patterns.some((regex) => regex.test(pathname));
}

function finalizeResponse(response: NextResponse, pathname: string, websiteId: string | null) {
  response.headers.set('x-request-path', pathname);
  if (websiteId) {
    response.headers.set('x-website-id', websiteId);
  } else {
    response.headers.delete('x-website-id');
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (matchesAny(pathname, STATIC_BYPASS_PATTERNS)) {
    return NextResponse.next();
  }

  const isApiPath = API_ROUTE.test(pathname);
  if (isApiPath && matchesAny(pathname, EXCLUDED_API_PATHS)) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(AUTHENTICATED_HEADER);
  if (!HEADER_BYPASS_ENABLED) {
    requestHeaders.delete(AUTH_BYPASS_USER_HEADER);
  }

  const authPage = matchesAny(pathname, PUBLIC_AUTH_PATHS);
  if (authPage) {
    requestHeaders.set('x-auth-page', '1');
  }

  const hasValidCookie = await verifySessionCookieEdge(
    request.cookies.get(AUTH_SESSION_COOKIE)?.value ?? null,
  );
  const hasBypass = HEADER_BYPASS_ENABLED && Boolean(request.headers.get(AUTH_BYPASS_USER_HEADER));
  const isAuthenticated = hasValidCookie || hasBypass;

  if (isAuthenticated) {
    requestHeaders.set(AUTHENTICATED_HEADER, '1');
  }

  const websiteId = request.headers.get('x-website-id');

  if (!isAuthenticated) {
    if (isApiPath && !matchesAny(pathname, PUBLIC_API_PATHS)) {
      const unauthorized = NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
      return finalizeResponse(unauthorized, pathname, websiteId);
    }

    if (!isApiPath && !matchesAny(pathname, PUBLIC_APP_PATHS)) {
      const redirectUrl = new URL('/sign-in', request.url);
      redirectUrl.searchParams.set('redirect_url', `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(redirectUrl);
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return finalizeResponse(response, pathname, websiteId);
}

export const config = {
  matcher: ['/:path*'],
};
