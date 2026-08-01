import type { VerifiedDomainInfo } from "@/lib/providers/email-types";
import { createResendClient } from "@/server/providers/resend/resend-client";
import { mapResendDomain } from "@/server/providers/resend/resend-normalizer";
import type { ResendDomainRecord } from "@/server/providers/resend/resend-types";

export async function listResendVerifiedDomains(apiKey: string, correlationId?: string): Promise<VerifiedDomainInfo[]> {
  const client = createResendClient({ apiKey, correlationId });
  const result = await client.listDomains();
  return (result.data.data ?? []).map((domain: ResendDomainRecord) => mapResendDomain(domain));
}

export function isDomainSendingEligible(domains: VerifiedDomainInfo[], fromAddress: string): boolean {
  const domainPart = fromAddress.includes("@") ? fromAddress.split("@")[1]?.toLowerCase() : undefined;
  if (!domainPart) return false;
  return domains.some((domain) => domain.name.toLowerCase() === domainPart && domain.sendingEligible);
}

export function extractDomainFromAddress(from: string): string | null {
  const match = from.match(/<([^>]+@[^>]+)>/) ?? from.match(/([^<\s]+@[^>\s]+)/);
  const email = match?.[1] ?? match?.[0];
  if (!email || !email.includes("@")) return null;
  return email.split("@")[1]?.toLowerCase() ?? null;
}

export function buildDnsGuidance(domain: VerifiedDomainInfo): string[] {
  const lines = [
    `Configure DNS records for ${domain.name} in your DNS provider.`,
    "Resend requires SPF and DKIM records before a domain can send in production.",
    "DMARC is strongly recommended for deliverability and spoofing protection.",
  ];
  if (domain.spfStatus && domain.spfStatus !== "verified") {
    lines.push("SPF record is not yet verified by Resend.");
  }
  if (domain.dkimStatus && domain.dkimStatus !== "verified") {
    lines.push("DKIM record is not yet verified by Resend.");
  }
  return lines;
}
