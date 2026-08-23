"use client";

import { createContext, useContext } from "react";
import type { MarketingCommandCentreData } from "@/server/services/marketing-command-centre-service";

const CommandCentrePreviewContext = createContext<MarketingCommandCentreData | null>(null);

export function CommandCentrePreviewProvider({
  data,
  children,
}: {
  data: MarketingCommandCentreData;
  children: React.ReactNode;
}) {
  return (
    <CommandCentrePreviewContext.Provider value={data}>
      {children}
    </CommandCentrePreviewContext.Provider>
  );
}

export function useCommandCentrePreviewData(): MarketingCommandCentreData | null {
  return useContext(CommandCentrePreviewContext);
}
