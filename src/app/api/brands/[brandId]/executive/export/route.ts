import { NextRequest, NextResponse } from "next/server";
import type { ExecutiveComparisonType } from "@prisma/client";
import { withApiHandler } from "@/lib/api/handler";
import { sanitizeCsvCell } from "@/lib/warehouse/csv-safety";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { executiveDashboardService } from "@/server/services/executive-dashboard-service";
import { generateExecutivePdf } from "@/server/services/executive-export-service";
import { brandService } from "@/server/services/workspace-service";

function parseDateRange(searchParams: URLSearchParams) {
  const toParam = searchParams.get("to");
  const fromParam = searchParams.get("from");
  const days = Number(searchParams.get("days") ?? "28");
  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - Math.max(1, days) * 86_400_000);
  return { from, to };
}

function csvLine(cells: string[]): string {
  return cells.map((cell) => `"${sanitizeCsvCell(cell).replace(/"/g, '""')}"`).join(",");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  const comparisonType = (request.nextUrl.searchParams.get("comparisonType") ??
    "PREVIOUS_PERIOD") as ExecutiveComparisonType;

  if (!organisationId) {
    return NextResponse.json({ error: "organisation_required" }, { status: 400 });
  }

  const { from, to } = parseDateRange(request.nextUrl.searchParams);

  return withApiHandler(
    request,
    async ({ tenant }) => {
      const context = tenant!;
      const brand = await brandService.getById(brandId, organisationId, context);
      const generatedAt = new Date().toISOString().slice(0, 10);

      if (format === "pdf") {
        const overview = await executiveDashboardService.getOverview(
          brandId,
          organisationId,
          from,
          to,
          comparisonType,
          context,
        );
        const objectives = await executiveDashboardService.getObjectives(
          brandId,
          organisationId,
          from,
          to,
          context,
        );
        const pdfBuffer = await generateExecutivePdf({
          generatedAt,
          period: overview.period,
          reportingCurrency: overview.reportingCurrency,
          disclaimer: overview.disclaimer,
          kpis: overview.kpis,
          objectives,
          brandName: brand.name,
        });
        return new NextResponse(new Uint8Array(pdfBuffer), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="executive-snapshot-${generatedAt}.pdf"`,
          },
        });
      }

      const exportData = await executiveDashboardService.exportCsv(
        brandId,
        organisationId,
        from,
        to,
        comparisonType,
        context,
      );

      const rows = [
        `# Executive export generated ${exportData.generatedAt}`,
        `# Period: ${exportData.period.from} to ${exportData.period.to}`,
        `# ${exportData.disclaimer}`,
        csvLine(["metric", "current", "previous", "change_absolute", "change_percent", "formula", "source"]),
        ...exportData.kpiRows.map((row) => csvLine(row)),
        "",
        csvLine([
          "objective_type",
          "description",
          "target",
          "actual",
          "progress_percent",
          "status",
          "target_period",
        ]),
        ...exportData.objectiveRows.map((row) => csvLine(row)),
        "",
        "# Formula appendix",
        csvLine(["metric", "definition"]),
        ...Object.entries(exportData.appendix).map(([key, value]) => csvLine([key, value])),
      ];

      return new NextResponse(rows.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="executive-export-${generatedAt}.csv"`,
        },
      });
    },
    { organisationId, permission: PERMISSIONS["marketingData.read"] },
  );
}
