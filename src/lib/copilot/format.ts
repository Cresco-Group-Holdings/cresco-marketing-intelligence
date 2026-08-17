import type { CopilotFact, CopilotInference, CopilotRecommendation, EvidenceItem } from "@/lib/copilot/types";

let evidenceCounter = 0;

export function resetEvidenceCounter(): void {
  evidenceCounter = 0;
}

export function createEvidence(
  input: Omit<EvidenceItem, "id"> & { id?: string },
): EvidenceItem {
  evidenceCounter += 1;
  return { id: input.id ?? `ev-${evidenceCounter}`, ...input };
}

export function createFact(statement: string, evidenceIds: string[]): CopilotFact {
  return { id: `fact-${evidenceIds.join("-")}`, statement, evidenceIds };
}

export function createInference(statement: string, evidenceIds: string[]): CopilotInference {
  return { id: `inf-${evidenceIds.join("-")}`, statement, evidenceIds };
}

export function createRecommendation(statement: string, evidenceIds: string[]): CopilotRecommendation {
  return { id: `rec-${evidenceIds.join("-")}`, statement, evidenceIds };
}

export function formatCurrency(value: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMultiplier(value: number): string {
  return `${value.toFixed(2)}x`;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function driverLabel(rank: "primary" | "secondary" | "minor"): string {
  switch (rank) {
    case "primary":
      return "Primary driver";
    case "secondary":
      return "Secondary driver";
    case "minor":
      return "Minor contributor";
  }
}
