"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { buildPageContext } from "@/lib/copilot/context";
import type { CopilotPageContext, CopilotResponse } from "@/lib/copilot/types";

type CopilotContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  pageContext: CopilotPageContext;
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  lastResponse: CopilotResponse | null;
  setLastResponse: (response: CopilotResponse | null) => void;
};

const CopilotContext = createContext<CopilotContextValue | null>(null);

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<CopilotResponse | null>(null);

  const pageContext = useMemo(
    () =>
      buildPageContext({
        route: pathname,
        dateRange: {
          preset: searchParams.get("preset") ?? undefined,
          from: searchParams.get("from") ?? undefined,
          to: searchParams.get("to") ?? undefined,
          comparison: searchParams.get("comparison") ?? undefined,
        },
        attributionModel: searchParams.get("model") ?? undefined,
      }),
    [pathname, searchParams],
  );

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((value) => !value), []);

  const value = useMemo(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      pageContext,
      conversationId,
      setConversationId,
      lastResponse,
      setLastResponse,
    }),
    [isOpen, open, close, toggle, pageContext, conversationId, lastResponse],
  );

  return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>;
}

export function useCopilot() {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error("useCopilot must be used within CopilotProvider");
  }
  return context;
}
