import { OrganicSocialShell } from "@/components/social/organic-social-shell";

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return <OrganicSocialShell>{children}</OrganicSocialShell>;
}
