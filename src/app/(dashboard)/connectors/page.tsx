import { redirect } from "next/navigation";

export default function LegacyConnectorsRedirectPage() {
  redirect("/integrations");
}
