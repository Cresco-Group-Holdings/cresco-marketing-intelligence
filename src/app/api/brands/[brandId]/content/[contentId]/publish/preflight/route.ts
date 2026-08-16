import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withContentPublish } from "@/lib/api/content-handler";
import { evaluateMediaReadiness } from "@/lib/publishing/media-readiness";
import { adaptContentForProvider } from "@/lib/publishing/content-adaptation";
import { createObjectStorageProvider } from "@/lib/storage/supabase-storage-provider";

const preflightBodySchema = z.object({
  connectionId: z.string().min(1),
  externalAccountId: z.string().min(1),
  contentVariantId: z.string().optional(),
});

type Params = { params: Promise<{ brandId: string; contentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(preflightBodySchema, await jsonBody(request));

  return withContentPublish(request, organisationId, async () => {
    const content = await prisma.contentItem.findFirst({
      where: { id: contentId, organisationId, brandId },
      include: {
        variants: true,
        assets: { include: { marketingAsset: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    if (!content) {
      return apiSuccess({ ready: false, blockers: ["Content not found."] });
    }

    const connection = await prisma.providerConnection.findFirst({
      where: { id: body.connectionId, organisationId },
      include: {
        accounts: {
          where: { externalAccountId: body.externalAccountId },
        },
      },
    });

    const blockers: string[] = [];
    if (!connection) blockers.push("Provider connection not found.");
    else if (!["CONNECTED", "DEGRADED"].includes(connection.status)) {
      blockers.push(`Connection is not active (${connection.status}).`);
    }

    const account = connection?.accounts[0];
    if (connection && !account) {
      blockers.push("Select an Instagram business account for this connection.");
    } else if (account && account.accountType !== "INSTAGRAM_BUSINESS" && !account.accountType.includes("instagram")) {
      blockers.push("Selected account is not an Instagram business account eligible for publishing.");
    }

    if (content.status !== "APPROVED") {
      blockers.push("Content must be approved before publishing.");
    }

    const variant = body.contentVariantId
      ? content.variants.find((row) => row.id === body.contentVariantId)
      : content.variants[0];

    const storage = createObjectStorageProvider();
    const signedUrls: string[] = [];
    for (const asset of content.assets) {
      if (asset.marketingAsset.status !== "READY") continue;
      const signed = await storage.createSignedUrl(asset.marketingAsset.storageKey, 3600);
      signedUrls.push(signed.url);
    }

    const readiness = evaluateMediaReadiness({
      assets: content.assets.map((row) => row.marketingAsset),
      signedUrls,
    });

    const adaptation = adaptContentForProvider({
      providerKey: "meta",
      operationType: "SOCIAL_PUBLISH_POST",
      caption: variant?.caption ?? content.primaryMessage,
      imageCount: readiness.mediaUrls.length,
    });

    return apiSuccess({
      ready: blockers.length === 0 && readiness.ready && adaptation.valid,
      blockers: [
        ...blockers,
        ...readiness.issues.map((issue) => issue.message),
        ...adaptation.issues.map((issue) => issue.message),
      ],
      warnings: adaptation.warnings.map((issue) => issue.message),
      mediaType: readiness.mediaType,
      mediaCount: readiness.mediaUrls.length,
      supportedContentTypes: ["IMAGE", "CAROUSEL", "REELS"],
      unsupportedContentTypes: ["STORY", "TEXT_POST", "POLL"],
    });
  });
}
