export const CONTENT_THEMES = [
  { key: "product_education", label: "Product education" },
  { key: "founder_story", label: "Founder story" },
  { key: "customer_proof", label: "Customer proof" },
  { key: "industry_analysis", label: "Industry analysis" },
  { key: "grants", label: "Grants" },
  { key: "regulation", label: "Regulation" },
  { key: "funding", label: "Funding" },
  { key: "case_study", label: "Case study" },
] as const;

export type ContentThemeKey = (typeof CONTENT_THEMES)[number]["key"];

export function resolveContentThemeLabel(pillar: string | null | undefined): string | null {
  if (!pillar) return null;
  const match = CONTENT_THEMES.find(
    (theme) => theme.key === pillar || theme.label.toLowerCase() === pillar.toLowerCase(),
  );
  return match?.label ?? pillar;
}
