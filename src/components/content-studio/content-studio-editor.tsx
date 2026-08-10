"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STUDIO_TYPES = [
  "SOCIAL_POST",
  "AD_COPY",
  "EMAIL",
  "BLOG_ARTICLE",
  "LANDING_PAGE",
  "VIDEO_SCRIPT",
  "IMAGE_BRIEF",
  "PRESS_RELEASE",
  "CASE_STUDY",
  "SALES_COPY",
  "SEO_CONTENT",
  "OTHER",
] as const;

const CHANNELS = [
  "WEBSITE",
  "SEO",
  "GOOGLE_ADS",
  "LINKEDIN",
  "INSTAGRAM",
  "TIKTOK",
  "FACEBOOK",
  "YOUTUBE",
  "X",
  "EMAIL",
] as const;

export type StudioEditorValues = {
  title: string;
  studioType: string;
  studioObjective: string;
  audienceSummary: string;
  contentBody: string;
  primaryCTA: string;
  primaryChannel: string;
  contentCampaignId: string;
  dueAt: string;
  scheduledFor: string;
  timezone: string;
};

type Props = {
  initialValues?: Partial<StudioEditorValues>;
  version?: number;
  readOnly?: boolean;
  onSave?: (values: StudioEditorValues) => Promise<void>;
  saving?: boolean;
};

const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const labelClass = "mb-1 block text-sm font-medium";

export function ContentStudioEditor({
  initialValues,
  version,
  readOnly = false,
  onSave,
  saving = false,
}: Props) {
  const [values, setValues] = useState<StudioEditorValues>({
    title: initialValues?.title ?? "",
    studioType: initialValues?.studioType ?? "SOCIAL_POST",
    studioObjective: initialValues?.studioObjective ?? "",
    audienceSummary: initialValues?.audienceSummary ?? "",
    contentBody: initialValues?.contentBody ?? "",
    primaryCTA: initialValues?.primaryCTA ?? "",
    primaryChannel: initialValues?.primaryChannel ?? "",
    contentCampaignId: initialValues?.contentCampaignId ?? "",
    dueAt: initialValues?.dueAt ?? "",
    scheduledFor: initialValues?.scheduledFor ?? "",
    timezone: initialValues?.timezone ?? "",
  });

  function update(field: keyof StudioEditorValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Content editor</CardTitle>
        {version !== undefined && (
          <span className="text-sm text-muted-foreground">Version {version}</span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label htmlFor="title" className={labelClass}>
            Title
          </label>
          <input
            id="title"
            className={fieldClass}
            value={values.title}
            onChange={(e) => update("title", e.target.value)}
            disabled={readOnly}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="studioType" className={labelClass}>
              Content type
            </label>
            <select
              id="studioType"
              className={fieldClass}
              value={values.studioType}
              onChange={(e) => update("studioType", e.target.value)}
              disabled={readOnly}
            >
              {STUDIO_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="primaryChannel" className={labelClass}>
              Primary channel
            </label>
            <select
              id="primaryChannel"
              className={fieldClass}
              value={values.primaryChannel}
              onChange={(e) => update("primaryChannel", e.target.value)}
              disabled={readOnly}
            >
              <option value="">None</option>
              {CHANNELS.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="objective" className={labelClass}>
            Objective
          </label>
          <input
            id="objective"
            className={fieldClass}
            value={values.studioObjective}
            onChange={(e) => update("studioObjective", e.target.value)}
            disabled={readOnly}
          />
        </div>

        <div>
          <label htmlFor="audience" className={labelClass}>
            Audience summary
          </label>
          <textarea
            id="audience"
            className={fieldClass}
            value={values.audienceSummary}
            onChange={(e) => update("audienceSummary", e.target.value)}
            disabled={readOnly}
            rows={2}
          />
        </div>

        <div>
          <label htmlFor="body" className={labelClass}>
            Content body
          </label>
          <textarea
            id="body"
            className={fieldClass}
            value={values.contentBody}
            onChange={(e) => update("contentBody", e.target.value)}
            disabled={readOnly}
            rows={8}
          />
        </div>

        <div>
          <label htmlFor="cta" className={labelClass}>
            Call to action
          </label>
          <input
            id="cta"
            className={fieldClass}
            value={values.primaryCTA}
            onChange={(e) => update("primaryCTA", e.target.value)}
            disabled={readOnly}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="dueAt" className={labelClass}>
              Due date
            </label>
            <input
              id="dueAt"
              type="datetime-local"
              className={fieldClass}
              value={values.dueAt}
              onChange={(e) => update("dueAt", e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div>
            <label htmlFor="scheduledFor" className={labelClass}>
              Scheduled for
            </label>
            <input
              id="scheduledFor"
              type="datetime-local"
              className={fieldClass}
              value={values.scheduledFor}
              onChange={(e) => update("scheduledFor", e.target.value)}
              disabled={readOnly}
            />
          </div>
        </div>

        {!readOnly && onSave && (
          <Button onClick={() => void onSave(values)} disabled={saving || !values.title.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
