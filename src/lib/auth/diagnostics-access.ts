import type { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/database/prisma";
import { resolveApiUser } from "@/lib/api/handler";

export function isAuthDatabaseDiagnosticsEnabled(): boolean {
  return process.env.PRODUCTION_AUTH_DATABASE_DIAGNOSTICS_ENABLED === "true";
}

async function assertOwnerDiagnosticsAccess(): Promise<void> {
  const user = await resolveApiUser();
  const ownerMembership = await prisma.organisationMembership.findFirst({
    where: {
      userId: user.userProfileId,
      role: OrganisationRole.OWNER,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (!ownerMembership) {
    throw new AppError("FORBIDDEN", "Diagnostics are restricted to organisation owners.");
  }
}

export async function assertAuthDatabaseDiagnosticsAccess(request: NextRequest): Promise<void> {
  if (!isAuthDatabaseDiagnosticsEnabled()) {
    throw new AppError("FORBIDDEN", "Auth/database diagnostics are disabled in this environment.");
  }

  const configuredToken = process.env.PRODUCTION_DIAGNOSTICS_TOKEN?.trim();
  const authorization = request.headers.get("authorization");

  if (configuredToken && authorization === `Bearer ${configuredToken}`) {
    return;
  }

  await assertOwnerDiagnosticsAccess();
}
