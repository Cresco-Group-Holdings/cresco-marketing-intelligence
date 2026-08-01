import { NextRequest } from "next/server";
import { readdirSync } from "node:fs";
import path from "node:path";
import { apiSuccess, createRequestId, handleApiError } from "@/lib/api/response";
import { assertAuthDatabaseDiagnosticsAccess } from "@/lib/auth/diagnostics-access";
import { buildAuthDatabaseDiagnostics } from "@/server/services/auth-database-diagnostics-service";

function countRepositoryMigrations(): number {
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  return readdirSync(migrationsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    .length;
}

export async function GET(request: NextRequest) {
  const requestId = createRequestId();

  try {
    await assertAuthDatabaseDiagnosticsAccess(request);
    const diagnostics = await buildAuthDatabaseDiagnostics(countRepositoryMigrations());
    return apiSuccess(diagnostics, { requestId });
  } catch (error) {
    const { handleApiError } = await import("@/lib/api/response");
    return handleApiError(error, requestId);
  }
}
