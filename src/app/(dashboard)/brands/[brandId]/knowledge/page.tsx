"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";

type ReadinessCategory = {
  category: string;
  label: string;
  score: number;
  filled: number;
  total: number;
  missing: Array<{ field: string; label: string; recommended: boolean }>;
};

type Readiness = {
  overallScore: number;
  categories: ReadinessCategory[];
  summary: string;
};

type NamedRecord = { id: string; name: string; [key: string]: unknown };

const SECTIONS = [
  "readiness",
  "audiences",
  "personas",
  "offers",
  "messaging",
  "voice",
  "competitors",
  "assets",
  "compliance",
  "import-export",
] as const;

type Section = (typeof SECTIONS)[number];

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <textarea
        className="block min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function commaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(values: string[] | undefined | null): string {
  return (values ?? []).join(", ");
}

export default function BrandKnowledgePage() {
  const params = useParams<{ brandId: string }>();
  const { preference } = useWorkspace();
  const [section, setSection] = useState<Section>("readiness");
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [audiences, setAudiences] = useState<NamedRecord[]>([]);
  const [personas, setPersonas] = useState<NamedRecord[]>([]);
  const [offers, setOffers] = useState<NamedRecord[]>([]);
  const [competitors, setCompetitors] = useState<NamedRecord[]>([]);
  const [assets, setAssets] = useState<NamedRecord[]>([]);
  const [complianceRules, setComplianceRules] = useState<NamedRecord[]>([]);
  const [messaging, setMessaging] = useState<Record<string, unknown>>({});
  const [voice, setVoice] = useState<Record<string, unknown>>({});
  const [newAudienceName, setNewAudienceName] = useState("");
  const [newPersonaName, setNewPersonaName] = useState("");
  const [newOfferName, setNewOfferName] = useState("");
  const [importJson, setImportJson] = useState("");
  const [exportJson, setExportJson] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const organisationId = preference.currentOrganisationId;
  const brandId = params.brandId;

  const apiBase = useCallback(
    (path: string) =>
      `/api/brands/${brandId}/knowledge${path}?organisationId=${organisationId}`,
    [brandId, organisationId],
  );

  const loadAll = useCallback(async () => {
    if (!organisationId) return;
    setError(null);
    try {
      const [readinessData, summaryData, audienceData, personaData, offerData, messagingData, voiceData, competitorData, assetData, complianceData] =
        await Promise.all([
          apiFetch<{ readiness: Readiness }>(apiBase("/readiness"), { organisationId }),
          apiFetch<{ summary: string }>(apiBase("/summary"), { organisationId }),
          apiFetch<{ audiences: NamedRecord[] }>(apiBase("/audiences"), { organisationId }),
          apiFetch<{ personas: NamedRecord[] }>(apiBase("/personas"), { organisationId }),
          apiFetch<{ offers: NamedRecord[] }>(apiBase("/offers"), { organisationId }),
          apiFetch<{ messaging: Record<string, unknown> | null }>(apiBase("/messaging"), { organisationId }),
          apiFetch<{ voice: Record<string, unknown> | null }>(apiBase("/voice"), { organisationId }),
          apiFetch<{ competitors: NamedRecord[] }>(apiBase("/competitors"), { organisationId }),
          apiFetch<{ assets: NamedRecord[] }>(apiBase("/assets"), { organisationId }),
          apiFetch<{ complianceRules: NamedRecord[] }>(apiBase("/compliance-rules"), { organisationId }),
        ]);

      setReadiness(readinessData.readiness);
      setSummary(summaryData.summary);
      setAudiences(audienceData.audiences);
      setPersonas(personaData.personas);
      setOffers(offerData.offers);
      setMessaging(messagingData.messaging ?? {});
      setVoice(voiceData.voice ?? {});
      setCompetitors(competitorData.competitors);
      setAssets(assetData.assets);
      setComplianceRules(complianceData.complianceRules);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load knowledge base.");
    }
  }, [apiBase, organisationId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function runAction(action: () => Promise<void>, successText: string) {
    if (!organisationId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      await loadAll();
      setMessage(successText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Brand knowledge base"
        description="Structured source of truth for brand-specific marketing content. No AI generation is connected."
        breadcrumbs={[
          { label: "Brands", href: "/brands" },
          { label: "Knowledge base" },
        ]}
        actions={
          <Link href={`/brands/${brandId}/profile`} className="text-sm font-medium text-slate-900 hover:underline">
            Brand profile
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {SECTIONS.map((item) => (
          <Button
            key={item}
            variant={section === item ? "primary" : "outline"}
            onClick={() => setSection(item)}
          >
            {item.replace("-", " ")}
          </Button>
        ))}
      </div>

      {section === "readiness" && readiness ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Overall readiness: {readiness.overallScore}%</CardTitle>
              <CardDescription>{readiness.summary}</CardDescription>
            </CardHeader>
          </Card>
          {readiness.categories.map((category) => (
            <Card key={category.category}>
              <CardHeader>
                <CardTitle>
                  {category.label}: {category.score}%
                </CardTitle>
                <CardDescription>
                  {category.filled}/{category.total} fields complete
                </CardDescription>
              </CardHeader>
              {category.missing.length > 0 ? (
                <CardContent>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {category.missing.map((field) => (
                      <li key={field.field}>
                        {field.label}
                        {field.recommended ? " (recommended)" : ""}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              ) : null}
            </Card>
          ))}
          <Card>
            <CardHeader>
              <CardTitle>Human-readable summary</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm text-slate-700">{summary}</pre>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "audiences" ? (
        <Card>
          <CardHeader>
            <CardTitle>Audience segments</CardTitle>
            <CardDescription>Define who the brand serves and how they buy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input label="New audience name" value={newAudienceName} onChange={(e) => setNewAudienceName(e.target.value)} />
              <Button
                className="mt-7"
                disabled={loading || !newAudienceName.trim()}
                onClick={() =>
                  void runAction(async () => {
                    await apiFetch(apiBase("/audiences"), {
                      method: "POST",
                      organisationId: organisationId!,
                      body: JSON.stringify({ name: newAudienceName.trim() }),
                    });
                    setNewAudienceName("");
                  }, "Audience created.")
                }
              >
                Add audience
              </Button>
            </div>
            {audiences.map((audience) => (
              <div key={audience.id} className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium">{audience.name as string}</p>
                <p className="text-sm text-slate-600">{(audience.description as string) || "No description yet."}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {section === "personas" ? (
        <Card>
          <CardHeader>
            <CardTitle>Personas</CardTitle>
            <CardDescription>Support multiple personas per brand without fictional personal data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input label="New persona name" value={newPersonaName} onChange={(e) => setNewPersonaName(e.target.value)} />
              <Button
                className="mt-7"
                disabled={loading || !newPersonaName.trim()}
                onClick={() =>
                  void runAction(async () => {
                    await apiFetch(apiBase("/personas"), {
                      method: "POST",
                      organisationId: organisationId!,
                      body: JSON.stringify({ name: newPersonaName.trim() }),
                    });
                    setNewPersonaName("");
                  }, "Persona created.")
                }
              >
                Add persona
              </Button>
            </div>
            {personas.map((persona) => (
              <div key={persona.id} className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium">{persona.name as string}</p>
                <p className="text-sm text-slate-600">{(persona.roleTitle as string) || "Role not specified."}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {section === "offers" ? (
        <Card>
          <CardHeader>
            <CardTitle>Offers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input label="New offer name" value={newOfferName} onChange={(e) => setNewOfferName(e.target.value)} />
              <Button
                className="mt-7"
                disabled={loading || !newOfferName.trim()}
                onClick={() =>
                  void runAction(async () => {
                    await apiFetch(apiBase("/offers"), {
                      method: "POST",
                      organisationId: organisationId!,
                      body: JSON.stringify({ name: newOfferName.trim() }),
                    });
                    setNewOfferName("");
                  }, "Offer created.")
                }
              >
                Add offer
              </Button>
            </div>
            {offers.map((offer) => (
              <div key={offer.id} className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium">{offer.name as string}</p>
                <p className="text-sm text-slate-600">{(offer.shortDescription as string) || "No description yet."}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {section === "messaging" ? (
        <Card>
          <CardHeader>
            <CardTitle>Messaging</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TextArea
              label="Elevator pitch"
              value={(messaging.elevatorPitch as string) ?? ""}
              onChange={(value) => setMessaging((current) => ({ ...current, elevatorPitch: value }))}
            />
            <TextArea
              label="Core message"
              value={(messaging.coreMessage as string) ?? ""}
              onChange={(value) => setMessaging((current) => ({ ...current, coreMessage: value }))}
            />
            <Input
              label="Supporting messages (comma-separated)"
              value={joinList(messaging.supportingMessages as string[])}
              onChange={(event) =>
                setMessaging((current) => ({ ...current, supportingMessages: commaList(event.target.value) }))
              }
            />
            <Input
              label="Prohibited claims (comma-separated)"
              value={joinList(messaging.prohibitedClaims as string[])}
              onChange={(event) =>
                setMessaging((current) => ({ ...current, prohibitedClaims: commaList(event.target.value) }))
              }
            />
            <Button
              disabled={loading}
              onClick={() =>
                void runAction(async () => {
                  await apiFetch(apiBase("/messaging"), {
                    method: "PUT",
                    organisationId: organisationId!,
                    body: JSON.stringify(messaging),
                  });
                }, "Messaging saved.")
              }
            >
              Save messaging
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {section === "voice" ? (
        <Card>
          <CardHeader>
            <CardTitle>Brand voice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Preferred tone"
              value={(voice.preferredTone as string) ?? ""}
              onChange={(event) => setVoice((current) => ({ ...current, preferredTone: event.target.value }))}
            />
            <Input
              label="Preferred vocabulary (comma-separated)"
              value={joinList(voice.vocabulary as string[])}
              onChange={(event) => setVoice((current) => ({ ...current, vocabulary: commaList(event.target.value) }))}
            />
            <Input
              label="Prohibited vocabulary (comma-separated)"
              value={joinList(voice.prohibitedVocabulary as string[])}
              onChange={(event) =>
                setVoice((current) => ({ ...current, prohibitedVocabulary: commaList(event.target.value) }))
              }
            />
            <TextArea
              label="Approved writing examples"
              value={joinList(voice.approvedExamples as string[])}
              onChange={(value) => setVoice((current) => ({ ...current, approvedExamples: commaList(value) }))}
            />
            <Button
              disabled={loading}
              onClick={() =>
                void runAction(async () => {
                  await apiFetch(apiBase("/voice"), {
                    method: "PUT",
                    organisationId: organisationId!,
                    body: JSON.stringify(voice),
                  });
                }, "Voice rules saved.")
              }
            >
              Save voice rules
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {section === "competitors" ? (
        <Card>
          <CardHeader>
            <CardTitle>Competitors</CardTitle>
            <CardDescription>Manually entered competitor profiles. No scraping yet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {competitors.map((competitor) => (
              <div key={competitor.id} className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium">{competitor.name as string}</p>
                <p className="text-sm text-slate-600">{(competitor.website as string) || "No website recorded."}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {section === "assets" ? (
        <Card>
          <CardHeader>
            <CardTitle>Brand assets</CardTitle>
            <CardDescription>Metadata and references. File storage is deferred to Task 1.6.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {assets.map((asset) => (
              <div key={asset.id} className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium">{asset.name as string}</p>
                <p className="text-sm text-slate-600">{asset.assetType as string}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {section === "compliance" ? (
        <Card>
          <CardHeader>
            <CardTitle>Compliance rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {complianceRules.map((rule) => (
              <div key={rule.id} className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium">{rule.title as string}</p>
                <p className="text-sm text-slate-600">{rule.ruleType as string}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {section === "import-export" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export</CardTitle>
              <CardDescription>Download structured JSON with version metadata.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                disabled={loading}
                onClick={() =>
                  void runAction(async () => {
                    const data = await apiFetch<{ export: unknown }>(apiBase("/export"), { organisationId: organisationId! });
                    setExportJson(JSON.stringify(data.export, null, 2));
                  }, "Export loaded.")
                }
              >
                Load export
              </Button>
              <textarea
                className="min-h-48 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs"
                readOnly
                value={exportJson}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Import</CardTitle>
              <CardDescription>Ownership fields in imported JSON are ignored and tenant context is preserved.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                className="min-h-48 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs"
                value={importJson}
                onChange={(event) => setImportJson(event.target.value)}
                placeholder='{"version":"1.0.0","personas":[{"name":"Retail investor"}]}'
              />
              <Button
                disabled={loading || !importJson.trim()}
                onClick={() =>
                  void runAction(async () => {
                    const payload = JSON.parse(importJson) as Record<string, unknown>;
                    await apiFetch(apiBase("/import"), {
                      method: "POST",
                      organisationId: organisationId!,
                      body: JSON.stringify(payload),
                    });
                    setImportJson("");
                  }, "Import completed.")
                }
              >
                Import JSON
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {message ? <p className="mt-4 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </>
  );
}
