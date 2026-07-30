import { ALLOWED_SCHEMA_TYPES } from "@/lib/briefs/constants";

export type SchemaSuggestion = {
  schemaType: string;
  rationale: string;
  eligibilityNote: string;
};

export function suggestSchemaTypes(input: {
  contentType?: string;
  hasFaq?: boolean;
  isHowTo?: boolean;
  isProduct?: boolean;
}): SchemaSuggestion[] {
  const suggestions: SchemaSuggestion[] = [];

  const add = (schemaType: string, rationale: string, eligibilityNote: string) => {
    if ((ALLOWED_SCHEMA_TYPES as readonly string[]).includes(schemaType)) {
      suggestions.push({ schemaType, rationale, eligibilityNote });
    }
  };

  add("Article", "Default for editorial content briefs.", "Does not guarantee rich results.");
  add("BreadcrumbList", "Supports site hierarchy when parent pages exist.", "Requires valid breadcrumb trail.");

  if (input.hasFaq) {
    add("FAQPage", "Brief includes FAQ section.", "FAQ content must be visible on page; no guarantee of FAQ rich results.");
  }
  if (input.isHowTo) {
    add("HowTo", "Brief structured as procedural guide.", "HowTo schema has strict eligibility requirements.");
  }
  if (input.isProduct) {
    add("Product", "Brief targets product/offering page.", "Requires accurate product data; no guarantee of product rich results.");
  }

  add("Organization", "Brand entity markup may complement content.", "Use brand-verified organisation data only.");

  return suggestions;
}

export function filterAllowedSchemaTypes(types: string[]): string[] {
  return types.filter((t) => (ALLOWED_SCHEMA_TYPES as readonly string[]).includes(t));
}
