import { SocialInboxView } from "@/components/inbox/social-inbox-view";

type PageProps = { params: Promise<{ conversationId: string }> };

export default async function InboxConversationDetailPage({ params }: PageProps) {
  const { conversationId } = await params;
  return <SocialInboxView mode="detail" conversationId={conversationId} />;
}
