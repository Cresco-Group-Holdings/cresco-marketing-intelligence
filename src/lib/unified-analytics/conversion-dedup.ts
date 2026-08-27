export type ConversionObservation = {
  id: string;
  provider: string;
  conversionType: string;
  occurredAt: string;
  value: number | null;
  currency?: string | null;
  transactionId?: string | null;
  externalId?: string | null;
};

export type DeduplicatedConversion = {
  canonicalId: string;
  conversionType: string;
  occurredAt: string;
  value: number | null;
  currency: string | null;
  sources: ConversionObservation[];
  dedupeMethod: "transaction_id" | "external_id" | "none";
  confidence: "high" | "medium" | "low";
};

/**
 * Deduplicates conversion observations across providers.
 * Preserves all source observations; picks one canonical record per transaction.
 */
export function deduplicateConversions(
  observations: ConversionObservation[],
): DeduplicatedConversion[] {
  const groups = new Map<string, ConversionObservation[]>();

  for (const obs of observations) {
    let key: string;
    if (obs.transactionId) {
      key = `txn:${obs.transactionId}`;
    } else if (obs.externalId) {
      key = `ext:${obs.externalId}`;
    } else {
      key = `singleton:${obs.id}`;
    }
    const bucket = groups.get(key) ?? [];
    bucket.push(obs);
    groups.set(key, bucket);
  }

  return [...groups.entries()].map(([key, sources]) => {
    const sorted = [...sources].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );
    const primary = sorted[0]!;
    const dedupeMethod: DeduplicatedConversion["dedupeMethod"] = key.startsWith("txn:")
      ? "transaction_id"
      : key.startsWith("ext:")
        ? "external_id"
        : "none";

    return {
      canonicalId: primary.id,
      conversionType: primary.conversionType,
      occurredAt: primary.occurredAt,
      value: primary.value,
      currency: primary.currency ?? null,
      sources,
      dedupeMethod,
      confidence:
        dedupeMethod === "transaction_id"
          ? "high"
          : dedupeMethod === "external_id"
            ? "medium"
            : "low",
    };
  });
}
