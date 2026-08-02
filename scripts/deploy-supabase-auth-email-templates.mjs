#!/usr/bin/env node

/**
 * Deploy Supabase auth email templates to a hosted project via the Management API.
 *
 * Required environment:
 *   SUPABASE_ACCESS_TOKEN  Personal access token from https://supabase.com/dashboard/account/tokens
 *   SUPABASE_PROJECT_REF   Project ref (e.g. dlvioewjekcylavxyfwk) or full https://<ref>.supabase.co URL
 *
 * Optional:
 *   SUPABASE_EMAIL_TEMPLATES  Comma-separated template keys to deploy (default: confirmation)
 */

import fs from "node:fs";
import path from "node:path";

const TEMPLATE_REGISTRY = {
  confirmation: {
    subjectKey: "mailer_subjects_confirmation",
    contentKey: "mailer_templates_confirmation_content",
    subject: "Confirm your email address",
    contentPath: "supabase/templates/confirm-signup.html",
    requiredSnippets: [
      "token_hash={{ .TokenHash }}",
      "/auth/callback",
      "type=email",
    ],
    forbiddenSnippets: ["{{ .ConfirmationURL }}"],
  },
};

function resolveProjectRef(value) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const hostname = new URL(trimmed).hostname;
      return hostname.split(".")[0] ?? null;
    }
  } catch {
    return null;
  }

  return trimmed;
}

function readTemplateContent(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Template file not found: ${relativePath}`);
  }

  return fs.readFileSync(absolutePath, "utf8").trim();
}

function validateTemplateContent(templateKey, content, rules) {
  for (const snippet of rules.requiredSnippets) {
    if (!content.includes(snippet)) {
      throw new Error(
        `Template "${templateKey}" is missing required snippet: ${snippet}`,
      );
    }
  }

  for (const snippet of rules.forbiddenSnippets) {
    if (content.includes(snippet)) {
      throw new Error(
        `Template "${templateKey}" must not include deprecated snippet: ${snippet}`,
      );
    }
  }
}

function buildDeployPayload(selectedKeys) {
  const payload = {};

  for (const key of selectedKeys) {
    const definition = TEMPLATE_REGISTRY[key];
    if (!definition) {
      throw new Error(`Unknown template key: ${key}`);
    }

    const content = readTemplateContent(definition.contentPath);
    validateTemplateContent(key, content, definition);

    payload[definition.subjectKey] = definition.subject;
    payload[definition.contentKey] = content;
  }

  return payload;
}

async function deployTemplates({ projectRef, accessToken, payload }) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const bodyText = await response.text();
  let bodyJson = null;

  if (bodyText) {
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      bodyJson = { raw: bodyText.slice(0, 500) };
    }
  }

  if (!response.ok) {
    const message =
      bodyJson?.message ??
      bodyJson?.error ??
      bodyJson?.raw ??
      `HTTP ${response.status}`;
    throw new Error(`Supabase Management API deploy failed: ${message}`);
  }

  return bodyJson;
}

async function main() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const projectRef = resolveProjectRef(
    process.env.SUPABASE_PROJECT_REF ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  );

  if (!accessToken) {
    console.error("SUPABASE_ACCESS_TOKEN is required.");
    process.exit(1);
  }

  if (!projectRef) {
    console.error(
      "SUPABASE_PROJECT_REF (or NEXT_PUBLIC_SUPABASE_URL) is required.",
    );
    process.exit(1);
  }

  const selectedKeys = (process.env.SUPABASE_EMAIL_TEMPLATES ?? "confirmation")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const payload = buildDeployPayload(selectedKeys);
  const result = await deployTemplates({ projectRef, accessToken, payload });

  console.log(
    JSON.stringify(
      {
        projectRef,
        deployedTemplates: selectedKeys,
        updatedKeys: Object.keys(payload).sort(),
        siteUrl: result?.site_url ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
