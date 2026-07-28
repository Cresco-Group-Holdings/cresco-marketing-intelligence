import { AppError } from "@/lib/errors";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

export function isAiDiagnosticsEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_AI_DIAGNOSTICS === "true";
}

export function assertAiDiagnosticsAccess(role: OrganisationRole): void {
  if (!isAiDiagnosticsEnabled()) {
    throw new AppError("FORBIDDEN", "AI diagnostics are not enabled in this environment.");
  }

  if (!hasPermission(role, PERMISSIONS["ai.diagnostics"])) {
    throw new AppError("FORBIDDEN", "AI diagnostics are restricted to administrators.");
  }
}
