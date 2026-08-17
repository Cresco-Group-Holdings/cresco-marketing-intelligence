"use client";

import { Suspense } from "react";
import { CopilotHeaderButton, CopilotPanel } from "@/components/copilot/copilot-panel";
import { CopilotProvider } from "@/components/copilot/copilot-provider";

export function CopilotShell({ children }: { children: React.ReactNode }) {
  return (
    <CopilotProvider>
      {children}
      <Suspense fallback={null}>
        <CopilotPanel />
      </Suspense>
    </CopilotProvider>
  );
}

export { CopilotHeaderButton };
