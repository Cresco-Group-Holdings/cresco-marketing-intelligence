CREATE TYPE "TikTokPrivacyLevel" AS ENUM ('PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY');

ALTER TABLE "PublishingJob" ADD COLUMN "directPublishAvailable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PublishingJob" ADD COLUMN "manualPublicUrl" TEXT;
ALTER TABLE "PublishingJob" ADD COLUMN "manualConfirmedAt" TIMESTAMP(3);
ALTER TABLE "PublishingJob" ADD COLUMN "manualConfirmedByUserId" TEXT;

CREATE TABLE "TikTokPublishSetting" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "contentVariantId" TEXT NOT NULL,
  "privacyLevel" "TikTokPrivacyLevel" NOT NULL,
  "disableComment" BOOLEAN NOT NULL DEFAULT false,
  "disableDuet" BOOLEAN NOT NULL DEFAULT false,
  "disableStitch" BOOLEAN NOT NULL DEFAULT false,
  "commercialContent" BOOLEAN NOT NULL DEFAULT false,
  "brandOrganicToggle" BOOLEAN NOT NULL DEFAULT false,
  "brandedContentToggle" BOOLEAN NOT NULL DEFAULT false,
  "videoCoverTimestampMs" INTEGER,
  "creatorOptionsSnapshot" JSONB NOT NULL,
  "selectedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TikTokPublishSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TikTokPublishSetting_contentVariantId_key" ON "TikTokPublishSetting"("contentVariantId");
CREATE INDEX "TikTokPublishSetting_organisationId_idx" ON "TikTokPublishSetting"("organisationId");
CREATE INDEX "TikTokPublishSetting_brandId_idx" ON "TikTokPublishSetting"("brandId");

ALTER TABLE "TikTokPublishSetting" ADD CONSTRAINT "TikTokPublishSetting_contentVariantId_fkey" FOREIGN KEY ("contentVariantId") REFERENCES "ContentVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
