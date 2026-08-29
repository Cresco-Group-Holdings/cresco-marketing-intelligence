import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";
import { LegalPage, type LegalSection } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms governing use of ${APP_NAME}.`,
};

const SECTIONS = [
  {
    title: "Agreement",
    paragraphs: [
      `By creating an account or using ${APP_NAME}, you agree to these Terms of Service and our Privacy Policy. If you use Cresco on behalf of an organisation, you confirm you have authority to bind that organisation.`,
    ],
  },
  {
    title: "The service",
    paragraphs: [
      `${APP_NAME} provides a marketing intelligence workspace for connecting channels, analysing performance, creating brand-aware content, scheduling publishing, and operating automations. Features vary by plan and connected integrations.`,
    ],
  },
  {
    title: "Your responsibilities",
    paragraphs: [
      "You are responsible for the accuracy of information you provide, compliance of content you publish, and permissions granted when connecting third-party accounts.",
    ],
    bullets: [
      "Review AI-generated content before publishing unless an approved workflow applies",
      "Ensure you have rights to use brand assets and customer data you upload",
      "Maintain the security of your account credentials",
      "Use automations and publishing features in line with provider platform policies",
    ],
  },
  {
    title: "AI and compliance features",
    paragraphs: [
      "Cresco may provide AI-assisted drafts, recommendations, and automated compliance checks. These tools support your workflow but do not constitute legal, financial, or regulatory approval. You remain responsible for final content and campaign decisions.",
    ],
  },
  {
    title: "Billing",
    paragraphs: [
      "Paid plans are billed through Stripe according to the plan selected at checkout. Fees, usage limits, and entitlements are defined in your plan catalogue. Failure to pay may restrict paid features after any applicable grace period.",
    ],
  },
  {
    title: "Availability and changes",
    paragraphs: [
      "We may update features, pricing, or these terms with reasonable notice where required. Beta or preview features may change or be withdrawn.",
    ],
  },
  {
    title: "Termination",
    paragraphs: [
      "You may cancel your subscription according to billing settings. We may suspend or terminate access for material breach, abuse, or legal requirement. Upon termination, access to the workspace ends subject to export and retention policies.",
    ],
  },
  {
    title: "Contact",
    paragraphs: ["Questions about these terms: support@cresco.group"],
  },
] as const satisfies readonly LegalSection[];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      description={`Terms governing access to and use of ${APP_NAME}.`}
      lastUpdated="25 August 2026"
      sections={SECTIONS}
    />
  );
}
