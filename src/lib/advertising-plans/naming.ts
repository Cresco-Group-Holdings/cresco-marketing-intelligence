export function previewCampaignName(
  template: string,
  vars: Record<string, string>,
): { preview: string; valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let preview = template;
  for (const [key, value] of Object.entries(vars)) {
    preview = preview.replace(new RegExp(`\\{${key}\\}`, "g"), value || "unknown");
  }
  if (preview.includes("{")) {
    warnings.push("Template contains unresolved placeholders.");
  }
  const providerLimit = 255;
  if (preview.length > providerLimit) {
    warnings.push(`Name exceeds provider limit of ${providerLimit} characters (${preview.length}).`);
  }
  return { preview, valid: warnings.length === 0, warnings };
}

export function generateInternalCampaignId(brandSlug: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${brandSlug.slice(0, 8).toUpperCase()}-${date}-${rand}`;
}
