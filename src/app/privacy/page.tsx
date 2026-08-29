import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";
import { LegalPage, type LegalSection } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${APP_NAME} collects, uses, and protects marketing data.`,
};

const SECTIONS = [
  {
    title: "Who we are",
    paragraphs: [
      `${APP_NAME} is operated by Cresco Group. This policy explains how we process personal and marketing data when you use the Cresco platform, website, and connected integrations.`,
    ],
  },
  {
    title: "Data we process",
    paragraphs: [
      "Depending on how you use Cresco, we may process account details, organisation and workspace metadata, connected marketing provider data, analytics and attribution data, content you create or approve, billing records, and support communications.",
    ],
    bullets: [
      "Account and profile information (name, email, role)",
      "Organisation, project, and brand workspace data",
      "OAuth tokens and provider connection metadata for integrations you authorise",
      "Website, advertising, organic social, and conversion analytics",
      "Content drafts, approvals, publishing schedules, and audit history",
      "Billing and subscription status via Stripe",
    ],
  },
  {
    title: "How we use data",
    paragraphs: [
      "We use data to provide the service you request: connecting providers, generating analytics, producing AI-assisted drafts, scheduling publishing, operating automations, and showing recommendations. We do not sell your marketing data.",
      "AI features use your brand context and connected data to generate suggestions. Generated output requires human review before publishing unless you explicitly configure approved automation workflows.",
    ],
  },
  {
    title: "Connected providers",
    paragraphs: [
      "When you connect a marketing provider, Cresco accesses only the scopes you approve. You can disconnect integrations at any time from Integrations or Organic Accounts. Disconnecting stops future syncs; previously imported data may remain according to your retention settings until deleted.",
    ],
  },
  {
    title: "Retention and deletion",
    paragraphs: [
      "We retain workspace data while your account is active and as needed to provide the service, meet legal obligations, and resolve disputes. Organisation owners can request workspace deletion subject to billing, legal, and backup constraints.",
    ],
  },
  {
    title: "Security",
    paragraphs: [
      "Cresco uses tenant isolation, encrypted credential storage, role-based access controls, and audit logging. No system is perfectly secure; report concerns to support@cresco.group.",
    ],
  },
  {
    title: "Contact",
    paragraphs: ["Privacy questions: support@cresco.group"],
  },
] as const satisfies readonly LegalSection[];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description={`This policy describes how ${APP_NAME} handles personal and marketing data.`}
      lastUpdated="25 August 2026"
      sections={SECTIONS}
    />
  );
}
