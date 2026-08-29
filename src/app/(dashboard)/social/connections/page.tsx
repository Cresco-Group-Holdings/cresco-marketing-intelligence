import { redirect } from "next/navigation";

export default function LegacySocialConnectionsRedirectPage() {
  redirect("/organic-social/accounts");
}
