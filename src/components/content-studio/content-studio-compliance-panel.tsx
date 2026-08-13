"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ComplianceFinding = {
  checkType: string;
  result: string;
  message: string;
  blocking: boolean;
};

type Props = {
  findings: ComplianceFinding[];
  onRunCheck?: () => Promise<void>;
  loading?: boolean;
};

export function ContentStudioCompliancePanel({ findings, onRunCheck, loading }: Props) {
  const [checking, setChecking] = useState(false);

  async function handleRunCheck() {
    if (!onRunCheck) return;
    setChecking(true);
    try {
      await onRunCheck();
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Brand compliance</CardTitle>
        {onRunCheck && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleRunCheck()}
            disabled={checking || loading}
          >
            {checking ? "Checking…" : "Run check"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          Deterministic checks against brand knowledge. Warnings only — not AI-verified.
        </p>
        {findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No compliance findings.</p>
        ) : (
          <ul className="space-y-2">
            {findings.map((finding, index) => (
              <li key={`${finding.checkType}-${index}`} className="rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      finding.result === "FAIL"
                        ? "warning"
                        : finding.result === "WARNING"
                          ? "warning"
                          : "muted"
                    }
                  >
                    {finding.result}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {finding.checkType.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-1 text-sm">{finding.message}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
