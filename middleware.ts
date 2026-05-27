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
  /^\/site\.webmanifest$/,
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
  /^\/api\/internal\/import-job$/,
  /^\/api\/internal\/import-persist$/,
  /^\/api\/internal\/design-system$/,
  /^\/api\/internal\/greenfield-job$/,
  /^\/api\/internal\/greenfield-persist$/,
];

const HEADER_BYPASS_ENABLED =
  process.env.ALLOW_AUTH_HEADER_BYPASS === 'true' && process.env.NODE_ENV !== 'production';
const PLAYWRIGHT_TARGET_TOKEN = process.env.PLAYWRIGHT_TARGET_TOKEN;
const PLAYWRIGHT_TARGET_HEADER_ENABLED = Boolean(PLAYWRIGHT_TARGET_TOKEN)
  && (process.env.NODE_ENV !== 'production' || process.env.STUDIO_DISABLE_WORKFLOW_PLUGIN === 'true');

function matchesAny(pathname: string, patterns: RegExp[]): boolean {
  return patterns.some((regex) => regex.test(pathname));
}

function isQaPreviewTokenRequest(request: NextRequest, pathname: string, isApiPath: boolean): boolean {
  if (request.method !== 'GET' || !request.nextUrl.searchParams.has('previewToken')) {
    return false;
  }

  if (isApiPath) {
    return pathname === '/api/studio/preview/data';
  }

  return pathname.startsWith('/studio/preview/site/');
}

function finalizeResponse(
  response: NextResponse,
  pathname: string,
  websiteId: string | null,
  options: { qaPreviewTokenRequest?: boolean } = {},
) {
  response.headers.set('x-request-path', pathname);
  if (options.qaPreviewTokenRequest) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
  }
  if (PLAYWRIGHT_TARGET_HEADER_ENABLED && PLAYWRIGHT_TARGET_TOKEN) {
    response.headers.set('x-catalyst-playwright-target', PLAYWRIGHT_TARGET_TOKEN);
  }
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
  const qaPreviewTokenRequest = isQaPreviewTokenRequest(request, pathname, isApiPath);

  if (!isAuthenticated) {
    if (isApiPath && !qaPreviewTokenRequest && !matchesAny(pathname, PUBLIC_API_PATHS)) {
      const unauthorized = NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
      return finalizeResponse(unauthorized, pathname, websiteId);
    }

    if (pathname.startsWith('/studio/preview/site') && !qaPreviewTokenRequest) {
      const unauthorized = NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
      return finalizeResponse(unauthorized, pathname, websiteId);
    }

    if (!isApiPath && !qaPreviewTokenRequest && !authPage && !matchesAny(pathname, PUBLIC_APP_PATHS)) {
      const redirectUrl = new URL('/sign-in', request.url);
      redirectUrl.searchParams.set('redirect_url', `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return finalizeResponse(NextResponse.redirect(redirectUrl), pathname, websiteId);
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return finalizeResponse(response, pathname, websiteId, { qaPreviewTokenRequest });
}

export const config = {
  matcher: ['/:path*'],
};
