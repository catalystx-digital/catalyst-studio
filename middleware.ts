import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AuthApiError, User } from "@supabase/supabase-js";
import {
  SUPABASE_USER_COOKIE,
  SUPABASE_USER_HEADER,
  decodeSerializedUser,
  serializeSupabaseUser,
  setUserCookie,
  toSupabaseUser,
  updateUserHeader,
} from "@/lib/supabase/user-header";
import {
  deleteCachedUser,
  getAuthCacheMetrics,
  getCachedUser,
  recordCacheBypass,
  storeCachedUser,
} from "@/lib/supabase/auth-cache";
import { getSupabaseConfig } from "@/lib/supabase/config";

const STATIC_BYPASS_PATTERNS = [/^\/_next\//, /^\/favicons?\//, /^\/robots\.txt$/, /^\/static\//, /^\/images\//, /^\/fonts\//, /^\/.well-known\/workflow\//, /^\/sandbox-template\.tar\.gz$/];
const PUBLIC_AUTH_PATHS = [/^\/sign-in(?:\/.*)?$/, /^\/sign-up(?:\/.*)?$/];
const API_ROUTE = /^\/(api|trpc)(.*)$/;
const PUBLIC_APP_PATHS = [/^\/$/, /^\/dashboard(?:\/)?$/, /^\/invite\/accept(?:\/)?$/];
const REFRESH_THROTTLE_COOKIE = "sb-refresh-throttle";
const REFRESH_THROTTLE_WINDOW_MS = 5_000;
const FRESH_AUTH_HEADER = "x-require-fresh-auth";
const CACHE_TTL_MS = Number.parseInt(process.env.SUPABASE_AUTH_CACHE_TTL_MS ?? "60000", 10);
const CACHE_DEBUG_ENABLED = process.env.SUPABASE_AUTH_CACHE_DEBUG === "true";
const CACHE_FRIENDLY_PATHS = [
  /^\/api\/studio\/import\/activity(?:\/.*)?$/,
  /^\/api\/sync\/status(?:\/.*)?$/,
  /^\/api\/sync\/history(?:\/.*)?$/,
  /^\/api\/dashboard\/import-activity(?:\/.*)?$/,
  /^\/api\/v1\/sync\/state(?:\/.*)?$/,
  /^\/api\/v1\/sync\/history(?:\/.*)?$/,
  /^\/api\/v1\/sync\/[^/]+\/status(?:\/.*)?$/,
];
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const EXCLUDED_API_PATHS = [
  /^\/api\/sync\/status(?:\/.*)?$/,
  /^\/api\/sync\/history(?:\/.*)?$/,
  /^\/api\/dashboard\/import-activity(?:\/.*)?$/,
  /^\/api\/v1\/sync\/state(?:\/.*)?$/,
  /^\/api\/v1\/sync\/history(?:\/.*)?$/,
  /^\/api\/v1\/sync\/[^/]+\/status(?:\/.*)?$/,
  /^\/api\/studio\/ucs\/graphql$/,
];
// Public API paths that don't require authentication
const PUBLIC_API_PATHS = [
  /^\/api\/studio\/invitations\/lookup$/,
  /^\/api\/auth\/session$/,
  /^\/api\/preview\/render$/, // Live preview API (TKT-054)
  /^\/api\/preview\/sandbox(?:\/.*)?$/, // Vercel Sandbox preview API (TKT-054)
  /^\/api\/studio\/preview\/data$/, // Preview data API (TKT-054)
  // Internal APIs called by workflow runtime (no user auth context)
  /^\/api\/internal\/import-job$/,
  /^\/api\/internal\/import-persist$/,
  /^\/api\/internal\/design-system$/,
  /^\/api\/internal\/greenfield-job$/,
  /^\/api\/internal\/greenfield-persist$/,
];
const HEADER_BYPASS_ENABLED = process.env.ALLOW_SUPABASE_HEADER_BYPASS === "true";

function shouldBypassStatic(pathname: string): boolean {
  return STATIC_BYPASS_PATTERNS.some((regex) => regex.test(pathname));
}

function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.some((regex) => regex.test(pathname));
}

function isApiRoute(pathname: string): boolean {
  return API_ROUTE.test(pathname);
}

function isPublicAppPath(pathname: string): boolean {
  return PUBLIC_APP_PATHS.some((regex) => regex.test(pathname));
}

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some((regex) => regex.test(pathname));
}

function isRefreshThrottled(request: NextRequest): boolean {
  const marker = request.cookies.get(REFRESH_THROTTLE_COOKIE);
  if (!marker) {
    return false;
  }

  const lastAttempt = Number.parseInt(marker.value, 10);
  if (Number.isNaN(lastAttempt)) {
    return false;
  }

  return Date.now() - lastAttempt < REFRESH_THROTTLE_WINDOW_MS;
}

function setRefreshThrottle(response: NextResponse) {
  response.cookies.set({
    name: REFRESH_THROTTLE_COOKIE,
    value: Date.now().toString(10),
    maxAge: Math.ceil(REFRESH_THROTTLE_WINDOW_MS / 1_000),
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
}

function clearRefreshThrottle(response: NextResponse) {
  response.cookies.delete(REFRESH_THROTTLE_COOKIE);
}

function clearSupabaseCookies(request: NextRequest, response: NextResponse) {
  const supabaseCookies = request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name.startsWith("sb-"));

  supabaseCookies.forEach((cookieName) => {
    if (cookieName === "sb-access-token") {
      const token = request.cookies.get(cookieName)?.value ?? null;
      if (token) {
        deleteCachedUser(token);
      }
    }
    response.cookies.delete(cookieName);
  });
}

function finalizeResponse(response: NextResponse, pathname: string, websiteId: string | null) {
  response.headers.set("x-request-path", pathname);
  if (websiteId) {
    response.headers.set("x-website-id", websiteId);
  } else {
    response.headers.delete("x-website-id");
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldBypassStatic(pathname)) {
    return NextResponse.next();
  }

  const isApiPath = isApiRoute(pathname);
  if (isApiPath && EXCLUDED_API_PATHS.some((regex) => regex.test(pathname))) {
    return NextResponse.next();
  }
  const websiteId = request.headers.get("x-website-id");
  const requestHeaders = new Headers(request.headers);

  const authPage = isPublicAuthPath(pathname);
  if (authPage) {
    requestHeaders.set("x-auth-page", "1");
  }

  const interimResponse = NextResponse.next();

  const refreshThrottled = isRefreshThrottled(request);
  const method = request.method?.toUpperCase?.() ?? "GET";
  const forceFreshHeader = request.headers.get(FRESH_AUTH_HEADER);
  const forceFresh = forceFreshHeader === "1" || forceFreshHeader === "true";
  const methodRequiresFresh = MUTATION_METHODS.has(method);
  const cachePreferredPath = CACHE_FRIENDLY_PATHS.some((regex) => regex.test(pathname));
  const mayTrustCache = !forceFresh && !methodRequiresFresh && method === "GET" && (cachePreferredPath || !isApiPath);
  const accessToken = request.cookies.get("sb-access-token")?.value ?? null;

  let cacheEvent: "none" | "hit" | "miss" | "bypass" | "cookie" = "none";
  let user: User | null = null;

  if (HEADER_BYPASS_ENABLED) {
    const headerPayload = request.headers.get(SUPABASE_USER_HEADER);

    if (headerPayload) {
      const serialized = decodeSerializedUser(headerPayload);
      if (serialized) {
        user = toSupabaseUser(serialized);
        cacheEvent = "bypass";
      }
    }

    // Only trust the sb-user-meta cookie if there's also a Supabase access token present.
    // This prevents stale cookies from being used after logout (when Supabase clears its session).
    if (!user && accessToken) {
      const cookieValue = request.cookies.get(SUPABASE_USER_COOKIE)?.value ?? null;
      if (cookieValue) {
        const serialized = decodeSerializedUser(cookieValue);
        if (serialized) {
          user = toSupabaseUser(serialized);
          cacheEvent = "cookie";
        }
      }
    }
  }

  if (mayTrustCache && accessToken) {
    const cachedUser = getCachedUser(accessToken);
    if (cachedUser) {
      user = toSupabaseUser(cachedUser);
      cacheEvent = "hit";
    } else {
      cacheEvent = "miss";
    }
  }

  // Only trust the sb-user-meta cookie if there's also a Supabase access token present.
  // This prevents stale cookies from being used after logout (when Supabase clears its session).
  if (!user && mayTrustCache && accessToken) {
    const cookieValue = request.cookies.get(SUPABASE_USER_COOKIE)?.value ?? null;
    if (cookieValue) {
      const serialized = decodeSerializedUser(cookieValue);
      if (serialized) {
        user = toSupabaseUser(serialized);
        if (cacheEvent === "none") {
          cacheEvent = "cookie";
        }
        const ttl = Number.isFinite(CACHE_TTL_MS) ? Math.max(CACHE_TTL_MS, 1_000) : 60_000;
        storeCachedUser(accessToken, serialized, ttl);
      }
    }
  }

  if (forceFresh || methodRequiresFresh) {
    recordCacheBypass();
    cacheEvent = "bypass";
  }

  if (!user && !refreshThrottled) {
    try {
      const { url, anonKey } = getSupabaseConfig();
      const supabase = createServerClient(url, anonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              interimResponse.cookies.set({ name, value, ...options });
            });
          },
        },
      });
      const {
        data: { user: fetchedUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        handleAuthError(userError, request, interimResponse);
      } else if (fetchedUser) {
        user = fetchedUser;
        if (accessToken) {
          const ttl = Number.isFinite(CACHE_TTL_MS) ? Math.max(CACHE_TTL_MS, 1_000) : 60_000;
          storeCachedUser(accessToken, serializeSupabaseUser(fetchedUser), ttl);
        }
        clearRefreshThrottle(interimResponse);
      } else if (accessToken) {
        deleteCachedUser(accessToken);
      }
    } catch (error) {
      handleAuthError(error, request, interimResponse);
    }
  }

  if (CACHE_DEBUG_ENABLED) {
    const metrics = getAuthCacheMetrics();
    console.debug("[supabase-auth-cache]", {
      event: cacheEvent,
      path: pathname,
      method,
      refreshThrottled,
      metrics,
    });
  }

  updateUserHeader(requestHeaders, user);

  if (authPage) {
    const authResponse = NextResponse.next({ request: { headers: requestHeaders } });
    propagateCookies(authResponse, interimResponse);
    setUserCookie(authResponse.cookies, user);
    return finalizeResponse(authResponse, pathname, websiteId);
  }

  if (!user) {
    if (isApiPath && !isPublicApiPath(pathname)) {
      const unauthorized = NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
      propagateCookies(unauthorized, interimResponse);
      setUserCookie(unauthorized.cookies, null);
      unauthorized.headers.set("x-request-path", pathname);
      if (websiteId) {
        unauthorized.headers.set("x-website-id", websiteId);
      }
      return unauthorized;
    }

    if (!isApiPath && !isPublicAppPath(pathname)) {
      const backUrl = request.url;
      const redirectUrl = new URL("/sign-in", request.url);
      redirectUrl.searchParams.set("redirect_url", backUrl);
      const redirectResponse = NextResponse.redirect(redirectUrl);
      propagateCookies(redirectResponse, interimResponse);
      setUserCookie(redirectResponse.cookies, null);
      return redirectResponse;
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  propagateCookies(response, interimResponse);
  setUserCookie(response.cookies, user);

  return finalizeResponse(response, pathname, websiteId);
}

function isAuthSessionMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const name = (error as { name?: string }).name;
  if (name === "AuthSessionMissingError") {
    return true;
  }

  const message = (error as { message?: string }).message ?? "";
  return /auth session missing/i.test(message);
}

function handleAuthError(error: unknown, request: NextRequest, response: NextResponse) {
  if (isAuthSessionMissingError(error)) {
    clearSupabaseCookies(request, response);
    console.info("[middleware] Supabase session missing; treating as logged-out state");
    return;
  }

  if (error instanceof AuthApiError) {
    if (error.status === 429 || error.code === "over_request_rate_limit") {
      setRefreshThrottle(response);
      clearSupabaseCookies(request, response);
      console.warn("[middleware] Supabase auth throttled", { status: error.status, code: error.code });
      return;
    }

    if (error.status === 400 && error.code?.includes("refresh_token")) {
      clearSupabaseCookies(request, response);
      console.warn("[middleware] Supabase refresh token invalidated", { status: error.status, code: error.code });
      return;
    }

    console.warn("[middleware] Supabase auth error", { status: error.status, code: error.code });
    return;
  }

  console.warn("[middleware] Unexpected auth error", error);
}

export const config = {
  matcher: ["/:path*"],
};

function propagateCookies(target: NextResponse, source: NextResponse) {
  const cookies = source.cookies.getAll();
  cookies.forEach((cookie) => {
    target.cookies.set({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      maxAge: cookie.maxAge,
      path: cookie.path ?? "/",
      sameSite: cookie.sameSite,
      secure: cookie.secure,
    });
  });
}
