"use client";

import { createContext, useContext } from "react";
import type { UnifiedAnalyticsWorkspaceData } from "@/lib/unified-analytics/types";

const UnifiedAnalyticsPreviewContext = createContext<UnifiedAnalyticsWorkspaceData | null>(null);

export function UnifiedAnalyticsPreviewProvider({
  data,
  children,
}: {
  data: UnifiedAnalyticsWorkspaceData;
  children: React.ReactNode;
}) {
  return (
    <UnifiedAnalyticsPreviewContext.Provider value={data}>
      {children}
    </UnifiedAnalyticsPreviewContext.Provider>
  );
}

export function useUnifiedAnalyticsPreviewData(): UnifiedAnalyticsWorkspaceData | null {
  return useContext(UnifiedAnalyticsPreviewContext);
}
