import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthRoute, isProtectedRoute } from "@/lib/auth/routes";
import { getSupabaseServerConfig, readSupabaseServerConfigFromProcessEnv } from "@/lib/environment/supabase";
import { applySecurityHeaders } from "@/lib/security/headers";
import { resolveSafeRedirectPath } from "@/lib/security/redirects";
import { E2E_AUTH_USER_HEADER, isE2eHarnessEnabled } from "@/lib/e2e/environment";
import { isProductionEnvironment, isTestAuthBypassEnabled } from "@/lib/security/production-guards";
import { createRequestHeadersWithPathname } from "@/lib/middleware/pathname";
import { resolveLegacyRouteRedirect } from "@/lib/navigation/legacy-redirects";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = createRequestHeadersWithPathname(request);

  if (process.env.NODE_ENV !== "development" && pathname.startsWith("/dev/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return applySecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  const legacyRedirect = resolveLegacyRouteRedirect(pathname);
  if (legacyRedirect) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = legacyRedirect;
    redirectUrl.search = "";
    return applySecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  let supabaseConfig: { url: string; anonKey: string } | null = null;
  try {
    supabaseConfig = getSupabaseServerConfig();
  } catch {
    const fallback = readSupabaseServerConfigFromProcessEnv();
    if (fallback.url && fallback.anonKey) {
      supabaseConfig = fallback;
    }
  }

  if (isProtectedRoute(pathname)) {
    const harnessAuthHeader = request.headers.get(E2E_AUTH_USER_HEADER)?.trim();
    const harnessHeaderBypass =
      !isProductionEnvironment() &&
      isE2eHarnessEnabled() &&
      process.env.ALLOW_TEST_AUTH === "true" &&
      Boolean(harnessAuthHeader);

    if (isTestAuthBypassEnabled() || harnessHeaderBypass) {
      return applySecurityHeaders(response);
    }
  }

  if (!supabaseConfig) {
    if (isProtectedRoute(pathname)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("redirect", pathname);
      return applySecurityHeaders(NextResponse.redirect(redirectUrl));
    }

    return applySecurityHeaders(response);
  }

  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtectedRoute(pathname) && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", resolveSafeRedirectPath(pathname, "/dashboard"));
    redirectUrl.searchParams.delete("code");
    return applySecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  if (isAuthRoute(pathname) && user) {
    const redirectParam = request.nextUrl.searchParams.get("redirect");
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = resolveSafeRedirectPath(redirectParam, "/dashboard");
    redirectUrl.search = "";
    return applySecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  return applySecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
