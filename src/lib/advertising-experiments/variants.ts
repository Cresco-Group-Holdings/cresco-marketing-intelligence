import { VARIANT_TYPES } from "./constants";

export type VariantInput = {
  variantType: string;
  label: string;
  sortOrder?: number;
  documentedVariables: Record<string, unknown>;
  providerCampaignId?: string;
  providerAdSetId?: string;
  providerAdId?: string;
  internalCreativeId?: string;
  providerResourceIds?: Record<string, string>;
};

export function validateVariants(variants: VariantInput[], experimentType: string) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (variants.length < 2) {
    errors.push("At least two variants are required.");
  }

  const controls = variants.filter((v) => v.variantType === "CONTROL");
  if (controls.length !== 1) {
    errors.push("Exactly one CONTROL variant is required.");
  }

  for (const variant of variants) {
    if (!(VARIANT_TYPES as readonly string[]).includes(variant.variantType)) {
      errors.push(`Invalid variant type: ${variant.variantType}`);
    }
    if (!variant.label?.trim()) errors.push("Each variant must have a label.");
    const vars = Object.keys(variant.documentedVariables ?? {});
    if (vars.length === 0) {
      warnings.push(`Variant "${variant.label}" has no documented variables.`);
    }
  }

  const allDocumentedKeys = variants.flatMap((v) => Object.keys(v.documentedVariables ?? {}));
  const uniqueKeys = new Set(allDocumentedKeys);
  if (uniqueKeys.size > 3 && experimentType !== "CAMPAIGN_STRUCTURE") {
    warnings.push("Variants differ in more than three documented variables — isolation may be compromised.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function checkVariantIsolation(variants: VariantInput[]): string[] {
  const issues: string[] = [];
  const control = variants.find((v) => v.variantType === "CONTROL");
  if (!control) return issues;

  for (const treatment of variants.filter((v) => v.variantType !== "CONTROL")) {
    const controlKeys = Object.keys(control.documentedVariables ?? {});
    const treatmentKeys = Object.keys(treatment.documentedVariables ?? {});
    const differing = [...new Set([...controlKeys, ...treatmentKeys])].filter(
      (key) =>
        JSON.stringify(control.documentedVariables?.[key]) !==
        JSON.stringify(treatment.documentedVariables?.[key]),
    );
    if (differing.length > 1) {
      issues.push(
        `Variant "${treatment.label}" differs from control in: ${differing.join(", ")}. Only one variable should change where practical.`,
      );
    }
  }

  return issues;
}
