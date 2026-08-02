import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthRoute, isProtectedRoute } from "@/lib/auth/routes";
import { getSupabaseServerConfig, readSupabaseServerConfigFromProcessEnv } from "@/lib/environment/supabase";
import { applySecurityHeaders } from "@/lib/security/headers";
import { resolveSafeRedirectPath } from "@/lib/security/redirects";
import { createRequestHeadersWithPathname } from "@/lib/middleware/pathname";

function isTestAuthEnabled(): boolean {
  return process.env.ALLOW_TEST_AUTH === "true" && Boolean(process.env.TEST_AUTH_USER_ID);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = createRequestHeadersWithPathname(request);

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

  if (isTestAuthEnabled() && isProtectedRoute(pathname)) {
    return applySecurityHeaders(response);
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
