import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SocialPage() {
  return (
    <>
      <PageHeader
        title="Social Media"
        description="Connect social accounts and prepare distribution workflows for the selected brand."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Social Media" }]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Account connections</CardTitle>
          <CardDescription>
            Securely connect Instagram, Facebook, LinkedIn, TikTok, YouTube, and X accounts to
            your brand. Publishing and analytics will be added in later stages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/social/connections"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Manage social connections
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
