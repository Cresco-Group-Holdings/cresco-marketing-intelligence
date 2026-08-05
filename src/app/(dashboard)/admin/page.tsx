import { AdminCentreLayout, AdminOverviewPanel } from "@/components/admin/admin-centre-panels";

export default function AdminOverviewPage() {
  return (
    <AdminCentreLayout title="Overview">
      <AdminOverviewPanel />
    </AdminCentreLayout>
  );
}
