"use client";

import { createContext, useContext } from "react";
import type { OrganicGrowthEngineData } from "@/lib/organic-growth/types";

const OrganicGrowthPreviewContext = createContext<OrganicGrowthEngineData | null>(null);

export function OrganicGrowthPreviewProvider({
  data,
  children,
}: {
  data: OrganicGrowthEngineData;
  children: React.ReactNode;
}) {
  return (
    <OrganicGrowthPreviewContext.Provider value={data}>
      {children}
    </OrganicGrowthPreviewContext.Provider>
  );
}

export function useOrganicGrowthPreviewData(): OrganicGrowthEngineData | null {
  return useContext(OrganicGrowthPreviewContext);
}
