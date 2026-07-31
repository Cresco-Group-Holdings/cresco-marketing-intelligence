import type { EmailDnsRecordStatus, EmailDomainSendingStatus } from "@prisma/client";

export type DomainStatusInput = {
  spfStatus: EmailDnsRecordStatus;
  dkimStatus: EmailDnsRecordStatus;
  dmarcStatus: EmailDnsRecordStatus;
  providerVerified: boolean;
};

export function isDomainReadyForSending(input: DomainStatusInput): boolean {
  return (
    input.spfStatus === "PASS" &&
    input.dkimStatus === "PASS" &&
    input.providerVerified
  );
}

export function resolveSendingStatus(input: DomainStatusInput): EmailDomainSendingStatus {
  if (isDomainReadyForSending(input)) return "READY";
  if (input.spfStatus === "FAIL" || input.dkimStatus === "FAIL") return "FAILED";
  if (input.spfStatus === "PENDING" || input.dkimStatus === "PENDING") return "VERIFYING";
  return "PENDING";
}

export function buildConfigInstructions(domain: string, providerSpf: string): Array<{ type: string; name: string; value: string }> {
  return [
    { type: "SPF", name: domain, value: `v=spf1 ${providerSpf} ~all` },
    { type: "DKIM", name: `selector._domainkey.${domain}`, value: "Add provider DKIM record" },
    { type: "DMARC", name: `_dmarc.${domain}`, value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}` },
  ];
}
