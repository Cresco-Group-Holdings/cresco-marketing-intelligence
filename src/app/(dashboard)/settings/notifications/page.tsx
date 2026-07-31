import { PageHeader } from "@/components/layout/page-header";
import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences-form";

export default function NotificationSettingsPage() {
  return (
    <>
      <PageHeader
        title="Notification preferences"
        description="Configure delivery channels, digests, and quiet hours per category."
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Notifications" },
        ]}
      />
      <NotificationPreferencesForm />
    </>
  );
}
