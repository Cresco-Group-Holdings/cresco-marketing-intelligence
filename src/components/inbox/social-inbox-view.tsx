"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import {
  INBOX_CONVERSATION_STATUS_LABELS,
  INBOX_PRIORITY_LABELS,
  INBOX_SAFETY_FLAG_LABELS,
} from "@/lib/inbox/constants";

type Mode = "all" | "comments" | "mentions" | "conversations" | "detail";

const nav = [
  ["All", "/inbox"],
  ["Comments", "/inbox/comments"],
  ["Mentions", "/inbox/mentions"],
  ["Messages", "/inbox/conversations"],
] as const;

const modeConversationType: Record<Exclude<Mode, "all" | "detail">, string> = {
  comments: "COMMENT",
  mentions: "MENTION",
  conversations: "DIRECT_MESSAGE",
};

type ConversationListItem = {
  id: string;
  conversationType: string;
  status: string;
  priority: string;
  summary: string | null;
  subject: string | null;
  unreadCount: number;
  lastMessageAt: string | null;
  safetyFlags: string[];
  requiresHumanReview: boolean;
  provider: string;
  socialAccount: {
    id: string;
    username: string | null;
    displayName: string | null;
    provider: string;
  };
  assignedTo: { id: string; displayName: string | null; email: string } | null;
  tags: Array<{ tag: string }>;
};

type ConversationDetail = ConversationListItem & {
  messages: Array<{
    id: string;
    direction: string;
    body: string;
    providerCreatedAt: string;
    sentBy: { displayName: string | null; email: string } | null;
    participant: { displayName: string | null; username: string | null } | null;
  }>;
  comments: Array<{
    id: string;
    body: string;
    providerCommentId: string;
    providerCreatedAt: string;
    isHidden: boolean;
    participant: { displayName: string | null; username: string | null } | null;
  }>;
  mentions: Array<{
    id: string;
    body: string;
    providerCreatedAt: string;
    participant: { displayName: string | null; username: string | null } | null;
  }>;
  postPreview: {
    source: string;
    title?: string | null;
    caption?: string | null;
    contentType?: string | null;
    providerPostId?: string;
    contentItemId?: string;
  } | null;
};

type Summary = {
  total: number;
  unread: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
};

export function SocialInboxView({
  mode,
  conversationId,
}: {
  mode: Mode;
  conversationId?: string;
}) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;

  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");
  const [socialAccountId, setSocialAccountId] = useState("");
  const [search, setSearch] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [tag, setTag] = useState("");
  const [priority, setPriority] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [list, setList] = useState<{ items: ConversationListItem[]; nextCursor: string | null } | null>(
    null,
  );
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(conversationId ?? null);
  const [replyBody, setReplyBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useMemo(() => {
    const params = new URLSearchParams({ organisationId: organisationId ?? "" });
    if (status) params.set("status", status);
    if (provider) params.set("provider", provider);
    if (socialAccountId) params.set("socialAccountId", socialAccountId);
    if (search.trim()) params.set("search", search.trim());
    if (assigneeUserId.trim()) params.set("assignedToUserId", assigneeUserId.trim());
    if (tag.trim()) params.set("tag", tag.trim());
    if (priority) params.set("priority", priority);
    if (unreadOnly) params.set("unreadOnly", "true");
    if (mode !== "all" && mode !== "detail") {
      params.set("conversationType", modeConversationType[mode]);
    }
    return params.toString();
  }, [
    organisationId,
    status,
    provider,
    socialAccountId,
    search,
    assigneeUserId,
    tag,
    priority,
    unreadOnly,
    mode,
  ]);

  const activeSocialAccountId = useMemo(() => {
    if (socialAccountId) return socialAccountId;
    if (detail?.socialAccount.id) return detail.socialAccount.id;
    const first = list?.items[0]?.socialAccount.id;
    return first ?? "";
  }, [socialAccountId, detail, list]);

  const loadSummary = useCallback(async () => {
    if (!brandId || !organisationId) return;
    try {
      setSummary(
        await apiFetch<Summary>(`/api/brands/${brandId}/inbox?${listQuery}`, { organisationId }),
      );
    } catch {
      // Summary failures should not block the list.
    }
  }, [brandId, organisationId, listQuery]);

  const loadList = useCallback(async () => {
    if (!brandId || !organisationId) return;
    setLoading(true);
    try {
      setList(
        await apiFetch<{ items: ConversationListItem[]; nextCursor: string | null }>(
          `/api/brands/${brandId}/inbox/conversations?${listQuery}`,
          { organisationId },
        ),
      );
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load inbox conversations.");
    } finally {
      setLoading(false);
    }
  }, [brandId, organisationId, listQuery]);

  const loadDetail = useCallback(
    async (id: string) => {
      if (!brandId || !organisationId) return;
      setDetailLoading(true);
      try {
        setDetail(
          await apiFetch<ConversationDetail>(
            `/api/brands/${brandId}/inbox/conversations/${id}?organisationId=${organisationId}`,
            { organisationId },
          ),
        );
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load conversation.");
      } finally {
        setDetailLoading(false);
      }
    },
    [brandId, organisationId],
  );

  useEffect(() => {
    void loadSummary();
    void loadList();
  }, [loadSummary, loadList]);

  useEffect(() => {
    const id = conversationId ?? selectedId;
    if (id) {
      void loadDetail(id);
    } else {
      setDetail(null);
    }
  }, [conversationId, selectedId, loadDetail]);

  async function postAction(
    action: string,
    body: Record<string, unknown>,
    id = selectedId ?? conversationId,
  ) {
    if (!brandId || !organisationId || !id || !activeSocialAccountId) {
      setActionMessage("Select a conversation and social account first.");
      return;
    }
    try {
      const result = await apiFetch<Record<string, unknown>>(
        `/api/brands/${brandId}/inbox/conversations/${id}/actions?action=${action}&organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({ socialAccountId: activeSocialAccountId, ...body }),
        },
      );
      if (action === "suggest" && typeof result.draft === "string") {
        setReplyBody(result.draft);
        setActionMessage("AI draft inserted — review before sending.");
      } else if (action === "copy" && typeof result.body === "string") {
        await navigator.clipboard.writeText(result.body);
        setActionMessage("Reply copied to clipboard.");
      } else if (action === "reply") {
        setReplyBody("");
        setActionMessage("Reply sent.");
      } else {
        setActionMessage(`${action} completed.`);
      }
      await loadList();
      await loadSummary();
      await loadDetail(id);
    } catch (caught) {
      setActionMessage(caught instanceof Error ? caught.message : "Action failed.");
    }
  }

  async function enqueueSync() {
    if (!brandId || !organisationId || !activeSocialAccountId) return;
    try {
      await apiFetch(`/api/brands/${brandId}/inbox/sync?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({
          socialAccountId: activeSocialAccountId,
          syncType: "INCREMENTAL",
          idempotencyKey: `manual:${activeSocialAccountId}:${new Date().toISOString().slice(0, 16)}`,
        }),
      });
      setActionMessage("Inbox sync queued.");
    } catch (caught) {
      setActionMessage(caught instanceof Error ? caught.message : "Unable to queue sync.");
    }
  }

  const showDetailPane = mode === "detail" || Boolean(selectedId);
  const breadcrumbs = [{ label: "Inbox", href: "/inbox" }, { label: mode }];

  return (
    <>
      <PageHeader
        title="Social inbox"
        description="Unified comments, mentions, and messages across connected social accounts."
        breadcrumbs={breadcrumbs}
      />
      <nav className="mb-4 flex flex-wrap gap-2">
        {nav.map(([label, href]) => (
          <Link key={href} className="text-sm underline" href={href}>
            {label}
          </Link>
        ))}
      </nav>

      {summary ? (
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Unread</CardTitle>
            </CardHeader>
            <CardContent>{summary.unread}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total</CardTitle>
            </CardHeader>
            <CardContent>{summary.total}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Open</CardTitle>
            </CardHeader>
            <CardContent>{(summary.byStatus.OPEN ?? 0) + (summary.byStatus.NEW ?? 0)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Resolved</CardTitle>
            </CardHeader>
            <CardContent>{summary.byStatus.RESOLVED ?? 0}</CardContent>
          </Card>
        </div>
      ) : null}

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {Object.entries(INBOX_CONVERSATION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
        >
          <option value="">All providers</option>
          {["INSTAGRAM", "FACEBOOK", "LINKEDIN", "TIKTOK", "YOUTUBE", "X"].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
        >
          <option value="">All priorities</option>
          {Object.entries(INBOX_PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.target.checked)}
          />
          Unread only
        </label>
        <Input label="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Input
          label="Social account ID"
          value={socialAccountId}
          onChange={(event) => setSocialAccountId(event.target.value)}
        />
        <Input
          label="Assignee user ID"
          value={assigneeUserId}
          onChange={(event) => setAssigneeUserId(event.target.value)}
        />
        <Input label="Tag" value={tag} onChange={(event) => setTag(event.target.value)} />
        <Button size="sm" variant="outline" onClick={() => void loadList()}>
          Refresh
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!activeSocialAccountId}
          onClick={() => void enqueueSync()}
        >
          Sync account
        </Button>
      </div>

      {actionMessage ? <p className="mb-3 text-sm text-foreground-muted">{actionMessage}</p> : null}
      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
      {!brandId ? <p>Select a brand to view the inbox.</p> : null}

      <div className={`grid gap-4 ${showDetailPane ? "lg:grid-cols-2" : ""}`}>
        {mode !== "detail" ? (
          <Card>
            <CardHeader>
              <CardTitle>Conversations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? <p className="text-sm text-foreground-muted">Loading conversations…</p> : null}
              {!loading && (list?.items.length ?? 0) === 0 ? (
                <p className="text-sm text-foreground-muted">No conversations match these filters.</p>
              ) : null}
              {list?.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`w-full rounded-lg border p-3 text-left text-sm transition hover:bg-surface-subtle ${
                    selectedId === item.id ? "border-primary bg-surface-subtle" : "border-border"
                  }`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {item.summary ?? item.subject ?? "Conversation"}
                    </span>
                    {item.unreadCount > 0 ? <Badge variant="warning">{item.unreadCount} unread</Badge> : null}
                    <Badge variant="muted">{item.conversationType}</Badge>
                    <Badge variant="muted">
                      {INBOX_CONVERSATION_STATUS_LABELS[
                        item.status as keyof typeof INBOX_CONVERSATION_STATUS_LABELS
                      ] ?? item.status}
                    </Badge>
                  </div>
                  <p className="text-foreground-muted">
                    {item.socialAccount.displayName ?? item.socialAccount.username ?? item.provider}
                    {item.lastMessageAt
                      ? ` · ${new Date(item.lastMessageAt).toLocaleString()}`
                      : ""}
                  </p>
                  {item.safetyFlags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.safetyFlags.map((flag) => (
                        <Badge key={flag} variant="warning">
                          {INBOX_SAFETY_FLAG_LABELS[flag as keyof typeof INBOX_SAFETY_FLAG_LABELS] ??
                            flag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </button>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {showDetailPane ? (
          <Card>
            <CardHeader>
              <CardTitle>Conversation detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {detailLoading ? <p className="text-sm text-foreground-muted">Loading conversation…</p> : null}
              {!detailLoading && !detail ? (
                <p className="text-sm text-foreground-muted">Select a conversation to view details.</p>
              ) : null}
              {detail ? (
                <>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="muted">{detail.conversationType}</Badge>
                      <Badge variant="muted">{detail.provider}</Badge>
                      {detail.requiresHumanReview ? (
                        <Badge variant="warning">Requires human review</Badge>
                      ) : null}
                    </div>
                    {detail.safetyFlags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {detail.safetyFlags.map((flag) => (
                          <Badge key={flag} variant="warning">
                            {INBOX_SAFETY_FLAG_LABELS[
                              flag as keyof typeof INBOX_SAFETY_FLAG_LABELS
                            ] ?? flag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <p className="text-sm text-foreground-muted">
                      Replying as{" "}
                      <strong>
                        {detail.socialAccount.displayName ??
                          detail.socialAccount.username ??
                          detail.socialAccount.provider}
                      </strong>
                    </p>
                  </div>

                  {detail.postPreview ? (
                    <div className="rounded-lg border border-border bg-surface-subtle p-3 text-sm">
                      <p className="font-medium">Related post</p>
                      {detail.postPreview.title ? <p>{detail.postPreview.title}</p> : null}
                      {detail.postPreview.caption ? (
                        <p className="text-foreground-muted">{detail.postPreview.caption}</p>
                      ) : null}
                      {detail.postPreview.providerPostId ? (
                        <p className="text-xs text-foreground-subtle">
                          Provider post: {detail.postPreview.providerPostId}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="max-h-80 space-y-3 overflow-y-auto rounded-lg border p-3">
                    {detail.messages.map((message) => (
                      <div key={message.id} className="text-sm">
                        <p className="text-xs text-foreground-subtle">
                          {message.direction} · {new Date(message.providerCreatedAt).toLocaleString()}
                          {message.sentBy ? ` · ${message.sentBy.displayName ?? message.sentBy.email}` : ""}
                          {message.participant
                            ? ` · ${message.participant.displayName ?? message.participant.username}`
                            : ""}
                        </p>
                        <p>{message.body}</p>
                      </div>
                    ))}
                    {detail.comments.map((comment) => (
                      <div key={comment.id} className="text-sm">
                        <p className="text-xs text-foreground-subtle">
                          Comment · {new Date(comment.providerCreatedAt).toLocaleString()}
                          {comment.participant
                            ? ` · ${comment.participant.displayName ?? comment.participant.username}`
                            : ""}
                          {comment.isHidden ? " · hidden" : ""}
                        </p>
                        <p>{comment.body}</p>
                      </div>
                    ))}
                    {detail.mentions.map((mention) => (
                      <div key={mention.id} className="text-sm">
                        <p className="text-xs text-foreground-subtle">
                          Mention · {new Date(mention.providerCreatedAt).toLocaleString()}
                          {mention.participant
                            ? ` · ${mention.participant.displayName ?? mention.participant.username}`
                            : ""}
                        </p>
                        <p>{mention.body}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="inbox-reply" className="block text-sm font-medium text-foreground-muted">
                      Reply
                    </label>
                    <textarea
                      id="inbox-reply"
                      className="min-h-28 w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
                      value={replyBody}
                      onChange={(event) => setReplyBody(event.target.value)}
                      placeholder="Write a reply…"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void postAction("suggest", {
                            instruction: "Draft a helpful on-brand reply.",
                          })
                        }
                      >
                        Suggest with AI
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!replyBody.trim()}
                        onClick={() => void postAction("copy", { body: replyBody })}
                      >
                        Copy reply
                      </Button>
                      <Button
                        size="sm"
                        disabled={!replyBody.trim()}
                        onClick={() =>
                          void postAction("reply", {
                            body: replyBody,
                            idempotencyKey: `reply:${detail.id}:${Date.now()}`,
                          })
                        }
                      >
                        Send reply
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void postAction("resolve", {})}
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
