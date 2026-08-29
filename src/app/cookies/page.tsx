import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How Cresco uses cookies and similar technologies.",
};

const SECTIONS = [
  {
    title: "Overview",
    paragraphs: [
      "Cresco uses cookies and similar technologies to keep you signed in, remember preferences, protect the service, and understand product usage.",
    ],
  },
  {
    title: "Essential cookies",
    paragraphs: [
      "These cookies are required for authentication, security, and core workspace functionality. The service cannot operate correctly without them.",
    ],
    bullets: [
      "Session and authentication cookies",
      "Security and CSRF protection",
      "Workspace preference storage",
    ],
  },
  {
    title: "Analytics cookies",
    paragraphs: [
      "We may use first-party product analytics to understand feature usage and improve the platform. We do not use analytics cookies to sell personal data.",
    ],
  },
  {
    title: "Managing cookies",
    paragraphs: [
      "You can control non-essential cookies through your browser settings. Blocking essential cookies may prevent login or workspace access.",
    ],
  },
  {
    title: "Contact",
    paragraphs: ["Cookie questions: support@cresco.group"],
  },
] as const satisfies readonly LegalSection[];

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      description="How Cresco uses cookies and similar technologies on the website and application."
      lastUpdated="25 August 2026"
      sections={SECTIONS}
    />
  );
}
