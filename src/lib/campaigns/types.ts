import type { CampaignStatus, CampaignObjective, CampaignLifecycleStage } from "@prisma/client";

export type CampaignReference = {
  id: string;
  workspaceId: string;
  organisationId: string;
  projectId: string;
  brandId: string;
  name: string;
  status: CampaignStatus;
  lifecycleStage: CampaignLifecycleStage;
  primaryObjective: CampaignObjective | null;
  version: number;
};
