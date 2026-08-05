import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { announcementService } from "@/server/services/announcement-service";

export async function GET(request: NextRequest) {
  const announcements = await announcementService.listActive();
  return apiSuccess({ announcements });
}
