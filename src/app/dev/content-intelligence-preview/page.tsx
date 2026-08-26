import { notFound } from "next/navigation";
import { redirect } from "next/navigation";

export default function ContentIntelligencePreviewIndex() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  redirect("/dev/content-intelligence-preview/overview");
}
