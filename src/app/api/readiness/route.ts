import { createRequestId, apiSuccess, handleApiError } from "@/lib/api/response";
import { runReadinessChecks } from "@/lib/observability/health-checks";

export async function GET() {
  const requestId = createRequestId();

  try {
    const report = await runReadinessChecks();

    return apiSuccess(
      {
        status: report.ready ? "ready" : "not_ready",
        checks: report.checks.map((check) => ({
          name: check.name,
          status: check.status,
          message: check.message,
        })),
        timestamp: report.timestamp,
      },
      { requestId },
      {
        status: report.ready ? 200 : 503,
        headers: {
          "x-request-id": requestId,
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
