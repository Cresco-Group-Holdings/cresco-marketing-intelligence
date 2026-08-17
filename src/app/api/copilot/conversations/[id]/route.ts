import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { copilotOrchestratorService } from "@/server/services/copilot-orchestrator-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withApiHandler(request, async ({ requestId, user }) => {
    const conversation = await copilotOrchestratorService.getConversation(user.userProfileId, id);
    if (!conversation) {
      return apiSuccess({ error: "not_found" }, { requestId, status: 404 });
    }
    return apiSuccess({ conversation }, { requestId });
  });
}
