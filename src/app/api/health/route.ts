import { createRequestId, apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET() {
  const requestId = createRequestId();

  try {
    return apiSuccess(
      {
        status: "ok",
        service: "cresco-marketing-intelligence",
        timestamp: new Date().toISOString(),
      },
      { requestId },
      {
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
