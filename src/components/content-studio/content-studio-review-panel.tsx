"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Review = {
  id: string;
  status: string;
  feedback: string | null;
  contentVersion: number;
  createdAt: string;
};

type Comment = {
  id: string;
  body: string;
  status: string;
  createdAt: string;
};

type Props = {
  status: string;
  reviews: Review[];
  comments: Comment[];
  allowedTransitions: string[];
  onSubmitForReview?: () => Promise<void>;
  onApprove?: () => Promise<void>;
  onRequestChanges?: (feedback: string) => Promise<void>;
  onTransition?: (status: string) => Promise<void>;
  canApprove?: boolean;
};

export function ContentStudioReviewPanel({
  status,
  reviews,
  comments,
  allowedTransitions,
  onSubmitForReview,
  onApprove,
  onRequestChanges,
  onTransition,
  canApprove = false,
}: Props) {
  const pendingReview = reviews.find((r) => r.status === "PENDING");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge>{status.replace(/_/g, " ")}</Badge>
          </div>

          {status === "DRAFT" && onSubmitForReview && (
            <Button size="sm" onClick={() => void onSubmitForReview()}>
              Submit for review
            </Button>
          )}

          {status === "IN_REVIEW" && canApprove && (
            <div className="flex gap-2">
              {onApprove && (
                <Button size="sm" onClick={() => void onApprove()}>
                  Approve
                </Button>
              )}
              {onRequestChanges && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const feedback = window.prompt("Describe requested changes:");
                    if (feedback) void onRequestChanges(feedback);
                  }}
                >
                  Request changes
                </Button>
              )}
            </div>
          )}

          {allowedTransitions
            .filter((t) => !["IN_REVIEW", "CHANGES_REQUESTED", "ARCHIVED"].includes(t))
            .map((transition) => (
              <Button
                key={transition}
                size="sm"
                variant="outline"
                onClick={() => onTransition && void onTransition(transition)}
              >
                Move to {transition.replace(/_/g, " ")}
              </Button>
            ))}

          {pendingReview && (
            <p className="text-xs text-muted-foreground">
              Pending review for version {pendingReview.contentVersion}
            </p>
          )}
        </CardContent>
      </Card>

      {reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-md border p-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="muted">{review.status}</Badge>
                  <span className="text-xs text-muted-foreground">v{review.contentVersion}</span>
                </div>
                {review.feedback && <p className="mt-1">{review.feedback}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {comments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-md border p-2 text-sm">
                <p>{comment.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(comment.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
