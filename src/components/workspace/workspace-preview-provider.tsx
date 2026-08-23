"use client";

import { useMemo } from "react";
import {
  WorkspaceContext,
  type WorkspaceContextValue,
  type WorkspaceState,
} from "@/components/workspace/workspace-provider";
import { resolveClientOnboardingStatus } from "@/lib/onboarding/status";

const PREVIEW_WORKSPACE: WorkspaceState = {
  organisations: [{ id: "org-preview", name: "Cresco Holdings", slug: "cresco-holdings" }],
  projects: [{ id: "project-preview", name: "Growth Platform", slug: "growth-platform" }],
  brands: [{ id: "brand-preview", name: "Cresco AI", slug: "cresco-ai", projectId: "project-preview" }],
  preference: {
    currentOrganisationId: "org-preview",
    currentProjectId: "project-preview",
    currentBrandId: "brand-preview",
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
    onboardingStep: null,
  },
  onboarding: { status: "complete", completedAt: "2026-01-01T00:00:00.000Z" },
};

export function WorkspacePreviewProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ...PREVIEW_WORKSPACE,
      loading: false,
      error: null,
      onboardingStatus: resolveClientOnboardingStatus({
        loading: false,
        error: null,
        onboardingCompletedAt: PREVIEW_WORKSPACE.preference.onboardingCompletedAt,
        serverStatus: "complete",
      }),
      refresh: async () => {},
      setOrganisation: async () => {},
      setProject: async () => {},
      setBrand: async () => {},
    }),
    [],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
