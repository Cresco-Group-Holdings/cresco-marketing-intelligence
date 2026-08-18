import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const settingsLinks = [
  { href: "/settings/account", title: "Account", description: "Display name, timezone, locale, and avatar URL." },
  { href: "/settings/security", title: "Security", description: "Password, connected providers, and reauthentication." },
  { href: "/settings/sessions", title: "Sessions", description: "Review the current session and revoke access globally." },
  { href: "/settings/organisation", title: "Organisation", description: "Name, legal details, timezone, and archive controls." },
  { href: "/settings/projects", title: "Projects", description: "Create and manage projects in the current organisation." },
  { href: "/settings/members", title: "Members", description: "View members, roles, and membership status." },
  { href: "/settings/invitations", title: "Invitations", description: "Invite teammates and manage pending invitations." },
  { href: "/settings/audit-log", title: "Audit log", description: "Review security-relevant workspace events." },
  { href: "/settings/billing", title: "Billing", description: "Subscription, usage limits, invoices, and plan upgrades." },
  { href: "/settings/notifications", title: "Notifications", description: "Delivery channels, digests, and quiet hours." },
  { href: "/settings/ai-usage", title: "AI & automation usage", description: "Requests, cost, automations, and provider availability." },
  { href: "/settings/ai-diagnostics", title: "AI diagnostics", description: "Administrator checks for provider configuration and structured output." },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage organisation administration, projects, members, and security preferences."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Settings" }]}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {settingsLinks.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full transition hover:border-border-strong">
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-medium text-foreground">Open</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
