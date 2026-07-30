import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const prismaMock = vi.hoisted(() => ({
  attributionModel: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  attributionModelVersion: {
    create: vi.fn(),
  },
  attributionJourney: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  attributionRun: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  attributionResult: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  attributionCredit: {
    create: vi.fn(),
  },
  attributionExclusionRule: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  attributionTouchpoint: {
    create: vi.fn(),
  },
  marketingEvent: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prismaMock)),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({ id: "brand-1", projectId: "project-1" }),
  },
}));
vi.mock("@/server/services/attribution-touchpoint-service", () => ({
  attributionTouchpointService: {
    extractTouchpointsForIdentity: vi.fn().mockResolvedValue([]),
    persistTouchpoints: vi.fn().mockResolvedValue([]),
    sessionToDraft: vi.fn(),
  },
}));

import { attributionModelService } from "@/server/services/attribution-model-service";
import { attributionJourneyService } from "@/server/services/attribution-journey-service";

const tenant = {
  organisationId: "org-1",
  userProfileId: "user-1",
  userId: "user-1",
  organisationRole: OrganisationRole.ADMIN,
};

describe("attribution permissions", () => {
  it("allows analysts to read marketing data", () => {
    expect(hasPermission(OrganisationRole.ANALYST, PERMISSIONS["marketingData.read"])).toBe(true);
  });

  it("prevents viewers from reprocessing attribution", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["marketingData.reprocess"])).toBe(false);
  });
});

describe("attribution model service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects cross-tenant model access", async () => {
    prismaMock.attributionModel.findFirst.mockResolvedValue(null);
    await expect(
      attributionModelService.getModel("brand-1", "org-1", "model-1", tenant),
    ).rejects.toThrow("Attribution model was not found.");
  });

  it("creates default models when none exist", async () => {
    prismaMock.attributionModel.count.mockResolvedValue(0);
    prismaMock.attributionModel.create.mockImplementation(async ({ data }) => ({
      id: `model-${data.modelType}`,
      ...data,
      versions: [],
    }));
    prismaMock.attributionModelVersion.create.mockResolvedValue({ id: "v-1", versionNumber: 1 });
    prismaMock.attributionModel.update.mockResolvedValue({});

    await attributionModelService.ensureDefaultModels("brand-1", "org-1", tenant);
    expect(prismaMock.attributionModel.create).toHaveBeenCalledTimes(5);
  });
});

describe("attribution journey service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates unattributed journey when identity is missing", async () => {
    prismaMock.attributionJourney.create.mockResolvedValue({
      id: "journey-1",
      status: "UNATTRIBUTED",
      identityId: null,
    });

    const journey = await attributionJourneyService.buildJourneyFromConversion(
      "brand-1",
      "org-1",
      {
        conversionType: "purchase",
        conversionAt: new Date(),
        lookbackWindowDays: 90,
        directTrafficPolicy: "RETAIN",
      },
      tenant,
    );

    expect(journey.status).toBe("UNATTRIBUTED");
    expect(prismaMock.attributionJourney.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "UNATTRIBUTED" }),
      }),
    );
  });

  it("marks journey as refunded", async () => {
    prismaMock.attributionJourney.findFirst.mockResolvedValue({ id: "j-1" });
    prismaMock.attributionJourney.update.mockResolvedValue({ id: "j-1", status: "REFUNDED" });

    const result = await attributionJourneyService.markRefunded("brand-1", "org-1", "j-1", tenant);
    expect(result.status).toBe("REFUNDED");
  });

  it("rejects cross-tenant journey access", async () => {
    prismaMock.attributionJourney.findFirst.mockResolvedValue(null);
    await expect(
      attributionJourneyService.getJourney("brand-1", "org-1", "journey-x", tenant),
    ).rejects.toThrow("Attribution journey was not found.");
  });
});

describe("model versioning", () => {
  it("increments version number on update", async () => {
    prismaMock.attributionModel.findFirst.mockResolvedValue({
      id: "model-1",
      projectId: "project-1",
      modelType: "LINEAR",
      directTrafficPolicy: "RETAIN",
      lookbackWindowDays: 90,
      config: null,
      versions: [{ versionNumber: 2 }],
    });
    prismaMock.attributionModelVersion.create.mockResolvedValue({ id: "v-3", versionNumber: 3 });
    prismaMock.attributionModel.update.mockResolvedValue({});

    const version = await attributionModelService.createVersion(
      "brand-1",
      "org-1",
      "model-1",
      { changelog: "Updated lookback" },
      tenant,
    );

    expect(version.versionNumber).toBe(3);
  });
});

describe("click identifiers", () => {
  it("parses provider click IDs from URL parameters", async () => {
    const { parseClickIds, extractClickIdFromUrl } = await import("@/lib/attribution/click-ids");
    expect(parseClickIds({ gclid: "abc123" })?.provider).toBe("google");
    expect(parseClickIds({ fbclid: "meta-id" })?.provider).toBe("meta");
    expect(extractClickIdFromUrl("https://example.com/?ttclid=tiktok-1")?.provider).toBe("tiktok");
  });
});

describe("extension point", () => {
  it("registers future model handlers without implementing them", async () => {
    const { registerAttributionExtension, getAttributionExtension } = await import(
      "@/lib/attribution/extension-point"
    );
    registerAttributionExtension({
      modelType: "DATA_DRIVEN",
      calculate: () => ({
        credits: [],
        excludedTouchpoints: [],
        totalCreditPercent: 0,
        limitations: ["Not implemented in Task 3.6"],
      }),
    });
    expect(getAttributionExtension("DATA_DRIVEN")).toBeDefined();
    expect(getAttributionExtension("MARKOV")).toBeUndefined();
  });
});
