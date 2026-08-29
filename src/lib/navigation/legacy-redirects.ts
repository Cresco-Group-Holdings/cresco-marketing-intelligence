/** Legacy customer-facing paths that redirect to canonical launch routes. */
export const LEGACY_ROUTE_REDIRECTS: Record<string, string> = {
  "/content": "/content/studio",
  "/connectors": "/integrations",
  "/social": "/organic-social",
  "/social/connections": "/organic-social/accounts",
  "/social/reels": "/organic-social/content",
  "/social/performance": "/organic-social/content",
  "/analyst": "/copilot",
  "/ai-agents": "/growth",
};

export function resolveLegacyRouteRedirect(pathname: string): string | null {
  if (LEGACY_ROUTE_REDIRECTS[pathname]) {
    return LEGACY_ROUTE_REDIRECTS[pathname];
  }

  if (pathname.startsWith("/analyst/")) {
    return "/copilot";
  }

  return null;
}
