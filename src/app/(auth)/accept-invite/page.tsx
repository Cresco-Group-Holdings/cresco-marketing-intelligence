import { Suspense } from "react";
import AcceptInviteClient from "./accept-invite-client";

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<p className="px-4 py-16 text-sm text-foreground-muted">Loading invitation...</p>}>
      <AcceptInviteClient />
    </Suspense>
  );
}
