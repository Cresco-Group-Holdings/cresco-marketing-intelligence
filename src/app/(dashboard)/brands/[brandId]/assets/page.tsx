"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch, apiUpload } from "@/lib/api/client";

type MarketingAsset = {
  id: string;
  title: string;
  description?: string | null;
  filename: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  assetType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  tags: string[];
  status: "PROCESSING" | "READY" | "REJECTED" | "ARCHIVED";
  approvedForMarketing: boolean;
  approvedPlatforms: string[];
  licenceOwner?: string | null;
  licenceNotes?: string | null;
  licenceExpiresAt?: string | null;
  attributionRequired: boolean;
  consentNotes?: string | null;
  createdAt: string;
  uploadedBy?: {
    displayName?: string | null;
    email: string;
  };
};

type ViewMode = "grid" | "list";

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BrandAssetLibraryPage() {
  const params = useParams<{ brandId: string }>();
  const { preference, brands } = useWorkspace();
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<MarketingAsset | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState("");
  const [approvedOnly, setApprovedOnly] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const organisationId = preference.currentOrganisationId;
  const brandId = params.brandId;
  const currentBrand = brands.find((brand) => brand.id === brandId);

  const queryString = useMemo(() => {
    const search = new URLSearchParams();
    if (organisationId) search.set("organisationId", organisationId);
    if (assetTypeFilter) search.set("assetType", assetTypeFilter);
    if (tagFilter) search.set("tag", tagFilter);
    if (approvedOnly) search.set("approvedForMarketing", "true");
    search.set("view", viewMode);
    return search.toString();
  }, [organisationId, assetTypeFilter, tagFilter, approvedOnly, viewMode]);

  const loadAssets = useCallback(async () => {
    if (!organisationId) return;
    setError(null);
    try {
      const data = await apiFetch<{ assets: MarketingAsset[] }>(
        `/api/brands/${brandId}/marketing-assets?${queryString}`,
        { organisationId },
      );
      setAssets(data.assets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assets.");
    }
  }, [brandId, organisationId, queryString]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  async function openPreview(asset: MarketingAsset) {
    if (!organisationId) return;
    setSelectedAsset(asset);
    setPreviewUrl(null);
    try {
      const data = await apiFetch<{ signedUrl: { url: string; expiresAt: string } }>(
        `/api/brands/${brandId}/marketing-assets/${asset.id}/signed-url?organisationId=${organisationId}`,
        { organisationId },
      );
      setPreviewUrl(data.signedUrl.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preview.");
    }
  }

  async function handleUpload(file: File) {
    if (!organisationId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (uploadTitle.trim()) formData.append("title", uploadTitle.trim());
      if (uploadTags.trim()) formData.append("tags", uploadTags.trim());

      await apiUpload<{ asset: MarketingAsset }>(
        `/api/brands/${brandId}/marketing-assets/upload?organisationId=${organisationId}`,
        formData,
        { organisationId },
      );

      setUploadTitle("");
      setUploadTags("");
      setMessage("Asset uploaded successfully.");
      await loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveGovernance() {
    if (!organisationId || !selectedAsset) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ asset: MarketingAsset }>(
        `/api/brands/${brandId}/marketing-assets/${selectedAsset.id}?organisationId=${organisationId}`,
        {
          method: "PUT",
          organisationId,
          body: JSON.stringify({
            title: selectedAsset.title,
            description: selectedAsset.description ?? "",
            tags: selectedAsset.tags,
            approvedForMarketing: selectedAsset.approvedForMarketing,
            approvedPlatforms: selectedAsset.approvedPlatforms,
            licenceOwner: selectedAsset.licenceOwner ?? "",
            licenceNotes: selectedAsset.licenceNotes ?? "",
            licenceExpiresAt: selectedAsset.licenceExpiresAt,
            attributionRequired: selectedAsset.attributionRequired,
            consentNotes: selectedAsset.consentNotes ?? "",
          }),
        },
      );
      setSelectedAsset(data.asset);
      setMessage("Asset governance updated.");
      await loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update asset.");
    } finally {
      setLoading(false);
    }
  }

  async function archiveAsset(assetId: string) {
    if (!organisationId) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        `/api/brands/${brandId}/marketing-assets/${assetId}?organisationId=${organisationId}`,
        { method: "DELETE", organisationId },
      );
      if (selectedAsset?.id === assetId) {
        setSelectedAsset(null);
        setPreviewUrl(null);
      }
      setMessage("Asset archived.");
      await loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive asset.");
    } finally {
      setLoading(false);
    }
  }

  const allTags = Array.from(new Set(assets.flatMap((asset) => asset.tags)));

  return (
    <>
      <PageHeader
        title="Asset library"
        description="Securely upload, organise, and reuse approved marketing assets."
        breadcrumbs={[
          { label: "Brands", href: "/brands" },
          { label: currentBrand?.name ?? "Brand", href: `/brands/${brandId}` },
          { label: "Asset library" },
        ]}
        actions={
          <div className="flex items-center gap-4">
            <Link href={`/brands/${brandId}/digital-assets`} className="text-sm font-medium text-foreground hover:underline">
              Digital asset library
            </Link>
            <Link href={`/brands/${brandId}/knowledge`} className="text-sm font-medium text-foreground hover:underline">
              Knowledge base
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upload asset</CardTitle>
            <CardDescription>PNG, JPG, WebP, SVG, PDF, MP4, MOV, and common audio formats.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Title (optional)" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} />
            <Input
              label="Tags (comma-separated)"
              value={uploadTags}
              onChange={(e) => setUploadTags(e.target.value)}
            />
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.svg,.pdf,.mp4,.mov,.mp3,.wav,.m4a,.aac,.ogg"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file);
                event.currentTarget.value = "";
              }}
              disabled={loading}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block text-sm font-medium text-foreground-muted">
              Asset type
              <select
                className="mt-2 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
                value={assetTypeFilter}
                onChange={(event) => setAssetTypeFilter(event.target.value)}
              >
                <option value="">All types</option>
                <option value="IMAGE">Image</option>
                <option value="VIDEO">Video</option>
                <option value="AUDIO">Audio</option>
                <option value="DOCUMENT">Document</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-foreground-muted">
              Tag
              <select
                className="mt-2 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
                value={tagFilter}
                onChange={(event) => setTagFilter(event.target.value)}
              >
                <option value="">All tags</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground-muted">
              <input
                type="checkbox"
                checked={approvedOnly}
                onChange={(event) => setApprovedOnly(event.target.checked)}
              />
              Approved for marketing only
            </label>
            <div className="flex gap-2">
              <Button variant={viewMode === "grid" ? "primary" : "outline"} onClick={() => setViewMode("grid")}>
                Grid
              </Button>
              <Button variant={viewMode === "list" ? "primary" : "outline"} onClick={() => setViewMode("list")}>
                List
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => (
            <Card key={asset.id}>
              <CardHeader>
                <CardTitle className="text-base">{asset.title}</CardTitle>
                <CardDescription>
                  {asset.assetType} · {formatBytes(asset.sizeBytes)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-foreground-muted">{asset.originalFilename}</p>
                {asset.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {asset.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-surface-hover px-2 py-1 text-xs text-foreground-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => void openPreview(asset)}>
                    Preview
                  </Button>
                  <Button variant="ghost" onClick={() => void archiveAsset(asset.id)} disabled={loading}>
                    Archive
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {assets.map((asset) => (
              <div key={asset.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium text-foreground">{asset.title}</p>
                  <p className="text-sm text-foreground-muted">
                    {asset.assetType} · {asset.mimeType} · {formatBytes(asset.sizeBytes)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => void openPreview(asset)}>
                    Preview
                  </Button>
                  <Button variant="ghost" onClick={() => void archiveAsset(asset.id)} disabled={loading}>
                    Archive
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {selectedAsset ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Asset details</CardTitle>
            <CardDescription>{selectedAsset.originalFilename}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewUrl ? (
              <div className="rounded-lg border border-border p-4">
                {selectedAsset.assetType === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt={selectedAsset.title} className="max-h-80 rounded-md object-contain" />
                ) : selectedAsset.assetType === "VIDEO" ? (
                  <video src={previewUrl} controls className="max-h-80 w-full rounded-md" />
                ) : selectedAsset.assetType === "AUDIO" ? (
                  <audio src={previewUrl} controls className="w-full" />
                ) : (
                  <a href={previewUrl} className="text-sm font-medium text-foreground hover:underline" target="_blank" rel="noreferrer">
                    Open signed preview
                  </a>
                )}
              </div>
            ) : null}

            <Input
              label="Title"
              value={selectedAsset.title}
              onChange={(event) => setSelectedAsset({ ...selectedAsset, title: event.target.value })}
            />
            <Input
              label="Tags (comma-separated)"
              value={selectedAsset.tags.join(", ")}
              onChange={(event) =>
                setSelectedAsset({
                  ...selectedAsset,
                  tags: event.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
            />
            <label className="flex items-center gap-2 text-sm text-foreground-muted">
              <input
                type="checkbox"
                checked={selectedAsset.approvedForMarketing}
                onChange={(event) =>
                  setSelectedAsset({ ...selectedAsset, approvedForMarketing: event.target.checked })
                }
              />
              Approved for marketing
            </label>
            <Input
              label="Approved platforms (comma-separated)"
              value={selectedAsset.approvedPlatforms.join(", ")}
              onChange={(event) =>
                setSelectedAsset({
                  ...selectedAsset,
                  approvedPlatforms: event.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                })
              }
            />
            <Input
              label="Licence owner"
              value={selectedAsset.licenceOwner ?? ""}
              onChange={(event) => setSelectedAsset({ ...selectedAsset, licenceOwner: event.target.value })}
            />
            <Input
              label="Licence notes"
              value={selectedAsset.licenceNotes ?? ""}
              onChange={(event) => setSelectedAsset({ ...selectedAsset, licenceNotes: event.target.value })}
            />
            <label className="flex items-center gap-2 text-sm text-foreground-muted">
              <input
                type="checkbox"
                checked={selectedAsset.attributionRequired}
                onChange={(event) =>
                  setSelectedAsset({ ...selectedAsset, attributionRequired: event.target.checked })
                }
              />
              Attribution required
            </label>
            <Input
              label="Consent notes"
              value={selectedAsset.consentNotes ?? ""}
              onChange={(event) => setSelectedAsset({ ...selectedAsset, consentNotes: event.target.value })}
            />
            <div className="flex gap-2">
              <Button onClick={() => void saveGovernance()} disabled={loading}>
                Save governance
              </Button>
              <Button variant="ghost" onClick={() => void archiveAsset(selectedAsset.id)} disabled={loading}>
                Archive asset
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {message ? <p className="mt-4 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
    </>
  );
}
