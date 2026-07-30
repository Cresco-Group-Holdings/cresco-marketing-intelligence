import PDFDocument from "pdfkit";
import type { MetricComparison } from "@/lib/executive/types";
import { EXECUTIVE_FORMULA_DEFINITIONS } from "@/lib/executive/constants";
import { formatMetricDisplay } from "@/lib/executive/metric-value";

type ExportPayload = {
  generatedAt: string;
  period: {
    from: string;
    to: string;
    comparisonFrom: string;
    comparisonTo: string;
  };
  reportingCurrency: string;
  disclaimer: string;
  kpis: Record<string, MetricComparison>;
  objectives: Array<{
    objectiveType: string;
    description: string;
    target: number;
    actual: { available: boolean; value: number | null };
    progressPercent: number | null;
    status: string;
    targetPeriod: string;
  }>;
  brandName: string;
};

export async function generateExecutivePdf(payload: ExportPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    document.fontSize(20).text("Executive Marketing Intelligence", { align: "left" });
    document.moveDown(0.5);
    document.fontSize(11).fillColor("#444444");
    document.text(payload.brandName);
    document.text(`Generated: ${payload.generatedAt}`);
    document.text(
      `Period: ${payload.period.from.slice(0, 10)} to ${payload.period.to.slice(0, 10)}`,
    );
    document.text(`Reporting currency: ${payload.reportingCurrency}`);
    document.moveDown();

    document.fontSize(14).fillColor("#000000").text("Executive KPIs");
    document.moveDown(0.5);
    document.fontSize(10);

    for (const [key, metric] of Object.entries(payload.kpis)) {
      const current = formatMetricDisplay(metric);
      const previous = formatMetricDisplay(metric.previous);
      const change =
        metric.changePercent != null
          ? ` (${metric.changeAbsolute != null && metric.changeAbsolute >= 0 ? "+" : ""}${metric.changePercent}%)`
          : "";
      document.text(`${key}: ${current} (prev: ${previous})${change}`);
    }

    document.moveDown();
    document.fontSize(14).text("Marketing Objectives");
    document.moveDown(0.5);
    document.fontSize(10);

    for (const objective of payload.objectives) {
      const actual = objective.actual.available
        ? String(objective.actual.value ?? "—")
        : "Unavailable";
      const progress =
        objective.progressPercent != null ? `${objective.progressPercent.toFixed(1)}%` : "—";
      document.text(
        `${objective.objectiveType}: target ${objective.target}, actual ${actual}, progress ${progress}`,
      );
    }

    document.moveDown();
    document.fontSize(14).text("Formula Appendix");
    document.moveDown(0.5);
    document.fontSize(9);
    for (const [key, formula] of Object.entries(EXECUTIVE_FORMULA_DEFINITIONS)) {
      document.text(`${key}: ${formula}`);
    }

    document.moveDown();
    document.fontSize(9).fillColor("#666666").text(payload.disclaimer);

    document.end();
  });
}
