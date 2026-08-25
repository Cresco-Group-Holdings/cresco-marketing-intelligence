export const DEMO_WORKSPACE_ROUTE = "/demo";

export const DEMO_WORKSPACE_LABEL = "Demo Data";

export type DemoWorkspaceState = {
  enabled: boolean;
  enteredAt: string | null;
};

export function isDemoWorkspaceRoute(pathname: string): boolean {
  return pathname === DEMO_WORKSPACE_ROUTE || pathname.startsWith(`${DEMO_WORKSPACE_ROUTE}/`);
}

export function canEnableDemoMode(input: {
  hasRealOrganisation: boolean;
  onboardingCompleted: boolean;
}): boolean {
  return !input.hasRealOrganisation || !input.onboardingCompleted;
}
