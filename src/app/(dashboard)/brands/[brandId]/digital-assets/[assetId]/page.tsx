"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import { DIGITAL_ASSET_STATUS_LABELS, DIGITAL_ASSET_TYPE_LABELS } from "@/lib/digital-assets/constants";

type AssetDetail = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  checksum: string;
  usages: Array<{ id: string; entityType: string; entityId: string; usageRole: string | null }>;
  versions: Array<{ id: string; version: number; createdAt: string }>;
};

export default function DigitalAssetDetailPage() {
  const params = useParams<{ brandId: string; assetId: string }>();
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [activity, setActivity] = useState<Array<{ action: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organisationId) return;
    setLoading(true);
    try {
      const [assetRes, activityRes] = await Promise.all([
        apiFetch<{ asset: AssetDetail }>(
          `/api/brands/${params.brandId}/digital-assets/${params.assetId}`,
          { organisationId },
        ),
        apiFetch<{ activity: Array<{ action: string; createdAt: string }> }>(
          `/api/brands/${params.brandId}/digital-assets/${params.assetId}/activity`,
          { organisationId },
        ),
      ]);
      setAsset(assetRes.asset);
      setActivity(activityRes.activity);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load asset.");
    } finally {
      setLoading(false);
    }
  }, [organisationId, params.assetId, params.brandId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!asset) return <p className="text-sm text-red-600">{error ?? "Not found"}</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={asset.name}
        description={`${DIGITAL_ASSET_TYPE_LABELS[asset.type]} · ${DIGITAL_ASSET_STATUS_LABELS[asset.status]} · v${asset.version}`}
        actions={
          <ButtonLink variant="outline" href={`/brands/${params.brandId}/digital-assets`}>
            Back to library
          </ButtonLink>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>MIME: {asset.mimeType}</p>
            <p>Size: {(asset.sizeBytes / 1024).toFixed(1)} KB</p>
            <p>Checksum: {asset.checksum}</p>
            {asset.description ? <p>{asset.description}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Usage locations</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {asset.usages?.length ? (
              asset.usages.map((u) => (
                <p key={u.id}>{u.entityType}: {u.entityId}{u.usageRole ? ` (${u.usageRole})` : ""}</p>
              ))
            ) : (
              <p className="text-slate-500">Not referenced anywhere.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Version history</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {asset.versions?.map((v) => (
              <p key={v.id}>v{v.version} · {new Date(v.createdAt).toLocaleString()}</p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {activity.map((a, i) => (
              <p key={i}>{a.action} · {new Date(a.createdAt).toLocaleString()}</p>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
