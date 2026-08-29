import { redirect } from "next/navigation";

/** Legacy content hub — canonical Content Studio lives at /content/studio */
export default function LegacyContentRedirectPage() {
  redirect("/content/studio");
}
