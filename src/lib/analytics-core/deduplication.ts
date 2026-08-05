import { createHash } from "node:crypto";

export type FactFingerprintInput = {
  organisationId: string;
  projectId?: string | null;
  brandId?: string | null;
  campaignId?: string | null;
  channel?: string | null;
  provider?: string | null;
  metricKey: string;
  occurredAt: Date | string;
  granularity: string;
  currency?: string | null;
  dimensions?: Record<string, unknown> | null;
};

function canonicalise(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalise(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalise(nested)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function buildFactFingerprint(input: FactFingerprintInput): string {
  const occurredAt =
    input.occurredAt instanceof Date ? input.occurredAt.toISOString() : new Date(input.occurredAt).toISOString();

  const payload = {
    organisationId: input.organisationId,
    projectId: input.projectId ?? null,
    brandId: input.brandId ?? null,
    campaignId: input.campaignId ?? null,
    channel: input.channel ?? null,
    provider: input.provider ?? null,
    metricKey: input.metricKey,
    occurredAt,
    granularity: input.granularity,
    currency: input.currency ?? null,
    dimensions: input.dimensions ?? {},
  };

  return createHash("sha256").update(canonicalise(payload)).digest("hex");
}
