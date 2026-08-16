import { isMockSocialAdapterAllowed } from "@/lib/providers/oauth/runtime";
import { registerAllMockSocialAdapters } from "@/lib/social/adapters/mock-social-adapter";

let bootstrapped = false;

export function ensureSocialAdaptersRegistered(): void {
  if (bootstrapped) {
    return;
  }
  if (isMockSocialAdapterAllowed()) {
    registerAllMockSocialAdapters();
  }
  bootstrapped = true;
}

export function resetSocialBootstrapForTests(): void {
  bootstrapped = false;
}
