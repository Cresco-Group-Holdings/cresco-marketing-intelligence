import { PaidAdvertisingShell } from "@/components/advertising/paid-advertising-shell";

export default function AdvertisingLayout({ children }: { children: React.ReactNode }) {
  return <PaidAdvertisingShell>{children}</PaidAdvertisingShell>;
}
