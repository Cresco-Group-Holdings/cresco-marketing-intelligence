import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { withPlatformAdmin } from "@/lib/api/admin-handler";
import { retentionService } from "@/server/services/retention-service";
import { staleLockRecoveryService } from "@/server/services/stale-lock-recovery-service";

export async function GET(request: NextRequest) {
  return withPlatformAdmin(request, async ({ requestId }) => {
    const policies = await retentionService.listPolicies();
    return apiSuccess({ policies }, { requestId });
  });
}

export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");
  return withPlatformAdmin(request, async ({ requestId }) => {
    if (action === "purge-audit") {
      const result = await retentionService.purgeExpiredAuditLogs();
      return apiSuccess({ result }, { requestId });
    }
    if (action === "purge-security-audit") {
      const result = await retentionService.purgeExpiredSecurityAuditLogs();
      return apiSuccess({ result }, { requestId });
    }
    if (action === "recover-stale-locks") {
      const publishing = await staleLockRecoveryService.recoverStalePublishingJobs();
      const alerts = await staleLockRecoveryService.recoverStaleOperationalAlerts();
      return apiSuccess({ publishing, alerts }, { requestId });
    }
    return apiSuccess({ message: "No action specified." }, { requestId });
  });
}
