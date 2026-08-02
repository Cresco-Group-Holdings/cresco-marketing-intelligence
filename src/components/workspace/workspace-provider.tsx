"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import {
  resolveClientOnboardingStatus,
  type ClientOnboardingStatus,
} from "@/lib/onboarding/status";

export type WorkspaceState = {
  organisations: Array<{ id: string; name: string; slug: string }>;
  projects: Array<{ id: string; name: string; slug: string }>;
  brands: Array<{ id: string; name: string; slug: string; projectId: string }>;
  preference: {
    currentOrganisationId: string | null;
    currentProjectId: string | null;
    currentBrandId: string | null;
    onboardingCompletedAt: string | null;
    onboardingStep: string | null;
  };
  onboarding?: {
    status: "complete" | "incomplete";
    completedAt: string | null;
  };
};

type WorkspaceContextValue = WorkspaceState & {
  loading: boolean;
  error: string | null;
  onboardingStatus: ClientOnboardingStatus;
  refresh: () => Promise<void>;
  setOrganisation: (organisationId: string) => Promise<void>;
  setProject: (projectId: string) => Promise<void>;
  setBrand: (brandId: string) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<WorkspaceState>("/api/workspace");
      setState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateWorkspace = useCallback(
    async (payload: Record<string, string | null | boolean | undefined>) => {
      const cleaned = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined),
      ) as Record<string, string | null | boolean>;
      const data = await apiFetch<WorkspaceState>("/api/workspace", {
        method: "PUT",
        body: JSON.stringify(cleaned),
      });
      setState(data);
    },
    [],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      organisations: state?.organisations ?? [],
      projects: state?.projects ?? [],
      brands: state?.brands ?? [],
      preference: state?.preference ?? {
        currentOrganisationId: null,
        currentProjectId: null,
        currentBrandId: null,
        onboardingCompletedAt: null,
        onboardingStep: null,
      },
      loading,
      error,
      onboardingStatus: resolveClientOnboardingStatus({
        loading,
        error,
        onboardingCompletedAt:
          state?.onboarding?.completedAt ?? state?.preference.onboardingCompletedAt ?? null,
        serverStatus: state?.onboarding?.status ?? null,
      }),
      refresh,
      setOrganisation: async (organisationId: string) =>
        updateWorkspace({ currentOrganisationId: organisationId, currentProjectId: null, currentBrandId: null }),
      setProject: async (projectId: string) =>
        updateWorkspace({
          currentOrganisationId: state?.preference.currentOrganisationId,
          currentProjectId: projectId,
          currentBrandId: null,
        }),
      setBrand: async (brandId: string) =>
        updateWorkspace({
          currentOrganisationId: state?.preference.currentOrganisationId,
          currentProjectId: state?.preference.currentProjectId,
          currentBrandId: brandId,
        }),
    }),
    [state, loading, error, refresh, updateWorkspace],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider.");
  }
  return context;
}
