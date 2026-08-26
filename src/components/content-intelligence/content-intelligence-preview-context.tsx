"use client";

import { createContext, useContext } from "react";
import type { ContentIntelligenceWorkspace } from "@/lib/content-intelligence/types";

const ContentIntelligencePreviewContext = createContext<ContentIntelligenceWorkspace | null>(null);

export function ContentIntelligencePreviewProvider({
  data,
  children,
}: {
  data: ContentIntelligenceWorkspace;
  children: React.ReactNode;
}) {
  return (
    <ContentIntelligencePreviewContext.Provider value={data}>
      {children}
    </ContentIntelligencePreviewContext.Provider>
  );
}

export function useContentIntelligencePreviewData() {
  return useContext(ContentIntelligencePreviewContext);
}
