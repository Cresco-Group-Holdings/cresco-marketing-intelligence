/**
 * Development-only fixture for security visual QA.
 * Never imported by production API routes or services.
 */

export type SecurityPreviewTab =
  | "overview"
  | "sessions"
  | "audit-log"
  | "permission-denied"
  | "provider-reauth"
  | "operations-failure"
  | "billing-security"
  | "privacy";

export type SecurityPreviewState = {
  tab: SecurityPreviewTab;
  title: string;
  description: string;
  alert?: { tone: "warning" | "error" | "info"; message: string };
  items: Array<{ label: string; value: string; meta?: string }>;
};

export const SECURITY_PREVIEW_STATES: Record<SecurityPreviewTab, SecurityPreviewState> = {
  overview: {
    tab: "overview",
    title: "Security settings",
    description: "Manage passwords, sessions, and connected sign-in providers.",
    items: [
      { label: "Password", value: "Configured", meta: "Last changed 14 days ago" },
      { label: "Two-factor", value: "Not enabled", meta: "Recommended for admin accounts" },
      { label: "Connected providers", value: "Google", meta: "1 provider" },
    ],
  },
  sessions: {
    tab: "sessions",
    title: "Active sessions",
    description: "Review devices with access to your account. Revoke any you do not recognise.",
    items: [
      { label: "Chrome on macOS", value: "Current session", meta: "London · Active now" },
      { label: "Safari on iPhone", value: "Active", meta: "London · 2 hours ago" },
    ],
  },
  "audit-log": {
    tab: "audit-log",
    title: "Audit log",
    description: "Security and administration events for your organisation.",
    items: [
      { label: "Provider connected", value: "Meta Ads", meta: "Alex Chen · 2 hours ago" },
      { label: "Role changed", value: "Marketer → Admin", meta: "Owner · Yesterday" },
      { label: "Content approved", value: "Q3 Launch Reel", meta: "Jamie · 2 days ago" },
    ],
  },
  "permission-denied": {
    tab: "permission-denied",
    title: "Permission required",
    description: "You do not have permission to manage billing for this organisation.",
    alert: {
      tone: "warning",
      message: "Contact an organisation admin if you need billing access.",
    },
    items: [{ label: "Required permission", value: "billing.manage" }],
  },
  "provider-reauth": {
    tab: "provider-reauth",
    title: "Reconnect required",
    description: "Your LinkedIn connection needs re-authorisation before publishing can resume.",
    alert: {
      tone: "warning",
      message: "Publishing to LinkedIn is paused until you reconnect.",
    },
    items: [
      { label: "Provider", value: "LinkedIn" },
      { label: "Status", value: "Reconnect required" },
      { label: "Last successful sync", value: "3 days ago" },
    ],
  },
  "operations-failure": {
    tab: "operations-failure",
    title: "Background job failure",
    description: "A scheduled publishing job failed. Your content was not published.",
    alert: {
      tone: "error",
      message: "Review the job details and retry when the provider connection is healthy.",
    },
    items: [
      { label: "Job", value: "Publish Instagram Reel" },
      { label: "Status", value: "Failed" },
      { label: "Reason", value: "Provider token expired" },
    ],
  },
  "billing-security": {
    tab: "billing-security",
    title: "Billing",
    description: "Manage your subscription and payment method securely via Stripe.",
    items: [
      { label: "Plan", value: "Growth" },
      { label: "Payment method", value: "•••• 4242", meta: "Expires 08/27" },
      { label: "Next invoice", value: "£249.00", meta: "1 Sep 2026" },
    ],
  },
  privacy: {
    tab: "privacy",
    title: "Privacy & data",
    description: "Control how your data is used and request export or deletion.",
    items: [
      { label: "Data export", value: "Available on request", meta: "Contact support" },
      { label: "Provider data", value: "Retained per policy", meta: "Disconnect removes tokens" },
      { label: "Analytics retention", value: "Per organisation policy" },
    ],
  },
};
