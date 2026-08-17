import { UnifiedAnalyticsShell } from "@/components/analytics/unified-analytics-shell";

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <UnifiedAnalyticsShell>{children}</UnifiedAnalyticsShell>;
}
