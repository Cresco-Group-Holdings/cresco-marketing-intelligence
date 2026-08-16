import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { tokenLifecycleService } from "@/server/services/token-lifecycle-service";

export const credentialRefreshService = {
  async refreshConnection(context: TenantContext, connectionId: string) {
    const result = await tokenLifecycleService.refreshConnectionTokens(
      { organisationId: context.organisationId, actorUserId: context.userId },
      connectionId,
    );

    if (result.status === "REFRESH_FAILED") {
      throw new AppError("AUTH_PROVIDER_UNAVAILABLE", "Token refresh failed.");
    }
    if (result.status === "REAUTH_REQUIRED") {
      throw new AppError("VALIDATION_ERROR", "Reauthorization required.");
    }

    return { refreshed: true, expiresAt: result.expiresAt?.toISOString() ?? null };
  },
};
