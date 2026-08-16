"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import {
  DIGITAL_ASSET_STATUS_LABELS,
  DIGITAL_ASSET_TYPE_LABELS,
} from "@/lib/digital-assets/constants";

type DigitalAsset = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  version: number;
  campaignId: string | null;
  checksum: string;
  createdAt: string;
  usages?: Array<{ entityType: string; entityId: string }>;
};

type ViewMode = "grid" | "list";

const ASSET_TYPES = Object.keys(DIGITAL_ASSET_TYPE_LABELS);

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function DigitalAssetLibraryView() {
  const params = useParams<{ brandId: string }>();
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;
  const brandId = params.brandId;

  const [assets, setAssets] = useState<DigitalAsset[]>([]);
  const [selected, setSelected] = useState<DigitalAsset | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    if (!organisationId) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.set("search", search);
      if (typeFilter) query.set("type", typeFilter);
      if (statusFilter) query.set("status", statusFilter);
      const data = await apiFetch<{ assets: DigitalAsset[] }>(
        `/api/brands/${brandId}/digital-assets?${query.toString()}`,
        { organisationId },
      );
      setAssets(data.assets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assets.");
    } finally {
      setLoading(false);
    }
  }, [brandId, organisationId, search, statusFilter, typeFilter]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  async function handleUpload(file: File) {
    if (!organisationId) return;
    const formData = new FormData();
    formData.append("file", file);
    setError(null);
    setMessage(null);
    try {
      const headers: HeadersInit = {};
      if (organisationId) headers["x-organisation-id"] = organisationId;
      const response = await fetch(`/api/brands/${brandId}/digital-assets/upload`, {
        method: "POST",
        body: formData,
        headers,
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Upload failed.");
      }
      if (body.data?.duplicate) {
        setMessage("Duplicate detected — existing asset returned.");
      } else {
        setMessage("Asset uploaded and queued for processing.");
      }
      await loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  async function openAsset(asset: DigitalAsset) {
    setSelected(asset);
    setPreviewUrl(null);
    if (!organisationId || asset.status !== "READY" || !asset.mimeType.startsWith("image/")) return;
    try {
      const data = await apiFetch<{ signedUrl: { url: string } }>(
        `/api/brands/${brandId}/digital-assets/${asset.id}/signed-url`,
        { organisationId },
      );
      setPreviewUrl(data.signedUrl.url);
    } catch {
      // preview optional
    }
  }

  if (!organisationId) {
    return <p className="text-sm text-foreground-muted">Select an organisation to manage digital assets.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Digital Asset Library"
        description="Canonical library for images, videos, documents, creatives, and campaign assets."
        actions={
          <ButtonLink variant="outline" href={`/brands/${brandId}/assets`}>
            Legacy marketing assets
          </ButtonLink>
        }
      />

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}
      {message ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-3 text-sm text-emerald-700">{message}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
          <CardDescription>Files are validated, checksum-deduplicated, and processed asynchronously.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            label="Upload file"
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.txt,.md,.doc,.docx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Input label="Search assets" placeholder="Search assets" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <select className="rounded-lg border px-3 py-2 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>{DIGITAL_ASSET_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select className="rounded-lg border px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {Object.keys(DIGITAL_ASSET_STATUS_LABELS).map((s) => (
            <option key={s} value={s}>{DIGITAL_ASSET_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => void loadAssets()}>Apply</Button>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant={viewMode === "grid" ? "primary" : "outline"} onClick={() => setViewMode("grid")}>Grid</Button>
          <Button size="sm" variant={viewMode === "list" ? "primary" : "outline"} onClick={() => setViewMode("list")}>List</Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-foreground-subtle">Loading assets…</p>
      ) : assets.length === 0 ? (
        <p className="text-sm text-foreground-subtle">No assets yet. Upload your first file.</p>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              className="rounded-lg border p-4 text-left hover:bg-surface-subtle"
              onClick={() => void openAsset(asset)}
            >
              <p className="font-medium">{asset.name}</p>
              <p className="text-sm text-foreground-subtle">
                {DIGITAL_ASSET_TYPE_LABELS[asset.type]} · {DIGITAL_ASSET_STATUS_LABELS[asset.status]}
              </p>
              <p className="text-xs text-foreground-subtle">{formatBytes(asset.sizeBytes)} · v{asset.version}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-subtle"
              onClick={() => void openAsset(asset)}
            >
              <div>
                <p className="font-medium">{asset.name}</p>
                <p className="text-sm text-foreground-subtle">
                  {DIGITAL_ASSET_TYPE_LABELS[asset.type]} · {DIGITAL_ASSET_STATUS_LABELS[asset.status]} · v{asset.version}
                </p>
              </div>
              <span className="text-xs text-foreground-subtle">{formatBytes(asset.sizeBytes)}</span>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>{selected.name}</CardTitle>
            <CardDescription>
              {DIGITAL_ASSET_TYPE_LABELS[selected.type]} · {DIGITAL_ASSET_STATUS_LABELS[selected.status]}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={selected.name} className="max-h-64 rounded border" />
            ) : null}
            <div className="grid gap-2 text-sm text-foreground-muted md:grid-cols-2">
              <p>MIME: {selected.mimeType}</p>
              <p>Size: {formatBytes(selected.sizeBytes)}</p>
              <p>Checksum: {selected.checksum.slice(0, 16)}…</p>
              <p>Version: {selected.version}</p>
              {selected.width ? <p>Dimensions: {selected.width}×{selected.height}</p> : null}
            </div>
            <div className="flex gap-2">
              <ButtonLink variant="outline" href={`/brands/${brandId}/digital-assets/${selected.id}`}>
                Full detail
              </ButtonLink>
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
