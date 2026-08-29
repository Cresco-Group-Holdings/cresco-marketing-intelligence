/** Client-side preview / dev fixture organisation IDs — never bill or meter. */
export const COMMERCIAL_EXEMPT_ORGANISATION_IDS = new Set([
  "org-preview",
  "org-demo",
  "demo-org",
]);

export function isCommercialUsageExempt(organisationId: string | null | undefined): boolean {
  if (!organisationId) return false;
  return COMMERCIAL_EXEMPT_ORGANISATION_IDS.has(organisationId);
}
