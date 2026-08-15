import { isProviderConnectorsEnabled } from "@/lib/providers/feature-flags";
import { isStage12OAuthProvider } from "@/lib/integrations/oauth/provider-definitions";

export function isStage12OAuthProviderEnabled(providerKey: string): boolean {
  return isProviderConnectorsEnabled() && isStage12OAuthProvider(providerKey);
}
