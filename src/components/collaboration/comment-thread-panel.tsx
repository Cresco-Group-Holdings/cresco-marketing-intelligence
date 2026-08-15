"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

type Comment = {
  id: string;
  body: string;
  html: string;
  author: { id: string; displayName: string | null };
  createdAt: string;
};

type Props = {
  organisationId: string | null;
  resourceType: string;
  resourceId: string;
};

export function CommentThreadPanel({ organisationId, resourceType, resourceId }: Props) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!organisationId) return;
    const data = await apiFetch<{
      thread: { id: string };
      comments: Comment[];
    }>(
      `/api/comments/threads?organisationId=${organisationId}&resourceType=${resourceType}&resourceId=${resourceId}`,
      { organisationId },
    );
    setThreadId(data.thread.id);
    setComments(data.comments);
  }, [organisationId, resourceType, resourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!organisationId || !threadId || !body.trim()) return;
    setLoading(true);
    try {
      await apiFetch(`/api/comments/threads/${threadId}?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({ body }),
      });
      setBody("");
      await load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="rounded-md border p-2 text-sm">
              <p className="font-medium">{comment.author.displayName ?? "User"}</p>
              <div dangerouslySetInnerHTML={{ __html: comment.html }} />
            </div>
          ))
        )}
        <textarea
          className="w-full rounded-md border px-3 py-2 text-sm"
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add a comment. Mention users with @userId"
        />
        <Button size="sm" disabled={loading || !body.trim()} onClick={() => void submit()}>
          Post comment
        </Button>
      </CardContent>
    </Card>
  );
}
