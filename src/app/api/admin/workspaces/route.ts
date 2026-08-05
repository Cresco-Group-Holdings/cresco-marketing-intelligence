import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { withPlatformAdmin } from "@/lib/api/admin-handler";
import { adminCentreService } from "@/server/services/admin-centre-service";

export async function GET(request: NextRequest) {
  return withPlatformAdmin(request, async ({ requestId }) => {
    const search = request.nextUrl.searchParams.get("search") ?? undefined;
    const workspaces = await adminCentreService.listWorkspaces({ search });
    return apiSuccess({ workspaces }, { requestId });
  });
}
