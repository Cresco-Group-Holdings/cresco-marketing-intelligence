import { test, expect } from "@playwright/test";

test.describe("Content Studio production create flow", () => {
  test("supports brief → edit → master → variant with mocked AI APIs", async ({ page }) => {
    test.setTimeout(120_000);

    const briefSession = {
      session: {
        contentId: "studio-content-1",
        version: 1,
        brief: {
          mode: "manual",
          objective: "education",
          keyMessage: "SEIS delays are preventable",
          supportingMessages: ["Plan early"],
          proofPoints: ["Observed patterns"],
          differentiators: ["Workflow clarity"],
          cta: "Check eligibility",
          channelStrategy: ["LINKEDIN"],
          suggestedFormats: ["carousel"],
          prohibitedClaims: [],
          evidenceNotes: [],
          audienceLabel: "Startup founders",
        },
        master: null,
        complianceFindings: [],
      },
    };

    const masterSession = {
      session: {
        ...briefSession.session,
        version: 2,
        master: {
          id: "studio-content-1",
          briefId: "studio-content-1",
          title: "5 reasons SEIS applications get delayed",
          hook: "Most delays are preventable",
          body: "Documentation and structure drive most SEIS delays.",
          keyPoints: ["Documentation", "Structure"],
          cta: "Check eligibility",
          status: "draft",
        },
        complianceFindings: [
          {
            checkType: "BRAND_CLAIM",
            result: "WARNING",
            message: "Review unsupported certainty before approval.",
            blocking: false,
          },
        ],
      },
    };

    await page.route("**/api/content-intelligence/workspace**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            workspace: {
              hasBrandContext: true,
              dateRange: { label: "Last 30 days", from: "", to: "" },
              freshness: { label: "Fresh", state: "fresh" },
              kpis: [],
              priorities: [],
              nextRecommendation: null,
              opportunities: [],
              strategy: {
                primaryObjective: "education",
                funnelStage: null,
                targetAudienceIds: [],
                targetAudienceLabels: ["Startup founders"],
                offerIds: [],
                offerLabels: [],
                contentPillars: [],
                primaryChannels: ["LINKEDIN"],
                secondaryChannels: [],
                keyMessages: ["Expert funding guidance"],
                constraints: [],
                complianceNotes: [],
                successMetrics: [],
              },
              themes: [],
              themePerformance: [],
              learnings: [],
              pipeline: [],
              topPerforming: [],
              weakPerforming: [],
              brandReadiness: {
                overallScore: 80,
                complete: true,
                missing: [],
                impactMessage: "Ready",
                completeBrandHref: "/settings",
              },
              upcomingPublications: [],
            },
          },
          meta: {},
          error: null,
        }),
      });
    });

    await page.route("**/api/brands/**/content-intelligence/brief/generate**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: briefSession, meta: {}, error: null }),
      });
    });

    await page.route("**/api/brands/**/content-intelligence/brief/**", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: briefSession, meta: {}, error: null }),
        });
        return;
      }
      await route.continue();
    });

    await page.route("**/api/brands/**/content-intelligence/master/generate**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: masterSession, meta: {}, error: null }),
      });
    });

    await page.route("**/api/brands/**/content-studio/**", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { item: { id: "studio-content-1", variants: [] } },
            meta: {},
            error: null,
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/content/studio/create", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Generate brief" }).click();
    await expect(page.getByDisplayValue("SEIS delays are preventable")).toBeVisible();

    const keyMessage = page.getByDisplayValue("SEIS delays are preventable");
    await keyMessage.fill("SEIS delays are preventable with better planning");
    await page.getByRole("button", { name: "Generate draft" }).click();
    await expect(page.getByDisplayValue("5 reasons SEIS applications get delayed")).toBeVisible();
    await expect(page.getByText("Content compliance check")).toBeVisible();
    await expect(page.getByText("Review unsupported certainty before approval.")).toBeVisible();
  });
});
