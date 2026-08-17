import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { buildPageContext } from "@/lib/copilot/context";
import { copilotOrchestratorService } from "@/server/services/copilot-orchestrator-service";

const querySchema = z.object({
  question: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
  pageContext: z.object({
    route: z.string(),
    module: z.string().optional(),
    entityType: z.string().optional(),
    entityId: z.string().optional(),
    dateRange: z
      .object({
        preset: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        comparison: z.string().optional(),
      })
      .optional(),
    attributionModel: z.string().optional(),
    activeFilters: z.record(z.string(), z.unknown()).optional(),
  }),
});

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ requestId, user }) => {
    const body = querySchema.parse(await request.json());
    const pageContext = buildPageContext({
      route: body.pageContext.route,
      dateRange: body.pageContext.dateRange,
      attributionModel: body.pageContext.attributionModel,
      entityType: body.pageContext.entityType,
      entityId: body.pageContext.entityId,
      activeFilters: body.pageContext.activeFilters,
    });

    const result = await copilotOrchestratorService.query(
      user.userProfileId,
      {
        question: body.question,
        conversationId: body.conversationId,
        pageContext,
      },
      requestId,
    );

    return apiSuccess(result, { requestId });
  });
}

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ requestId, user }) => {
    const conversations = await copilotOrchestratorService.listConversations(user.userProfileId);
    return apiSuccess({ conversations }, { requestId });
  });
}
