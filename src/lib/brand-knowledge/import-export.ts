import { BRAND_KNOWLEDGE_OWNERSHIP_FIELDS } from "@/lib/brand-knowledge/constants";

export function stripOwnershipFields<T extends Record<string, unknown>>(input: T): Omit<T, (typeof BRAND_KNOWLEDGE_OWNERSHIP_FIELDS)[number]> {
  const output = { ...input };
  for (const field of BRAND_KNOWLEDGE_OWNERSHIP_FIELDS) {
    delete output[field];
  }
  return output;
}

export function stripOwnershipFromCollection<T extends Record<string, unknown>>(
  items: T[] | undefined,
): Array<Omit<T, (typeof BRAND_KNOWLEDGE_OWNERSHIP_FIELDS)[number]>> {
  return (items ?? []).map((item) => stripOwnershipFields(item));
}
