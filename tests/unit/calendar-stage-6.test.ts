import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("stage 6 calendar migration", () => {
  const sql = readFileSync(
    path.join(
      process.cwd(),
      "prisma/migrations/20260805140000_stage_6_content_calendar/migration.sql",
    ),
    "utf8",
  );

  it("creates CalendarEvent with source locking", () => {
    expect(sql).toContain('CREATE TABLE "CalendarEvent"');
    expect(sql).toContain('"sourceLocked" BOOLEAN NOT NULL DEFAULT false');
    expect(sql).toContain("CalendarEvent_source_key");
  });
});

describe("calendar API route tree", () => {
  const routes = [
    "src/app/api/calendar/events/route.ts",
    "src/app/api/calendar/events/[eventId]/route.ts",
    "src/app/api/calendar/events/[eventId]/cancel/route.ts",
    "src/app/api/calendar/upcoming/route.ts",
    "src/app/api/calendar/unscheduled/route.ts",
    "src/app/api/calendar/overdue/route.ts",
    "src/app/api/calendar/conflicts/route.ts",
  ];

  for (const route of routes) {
    it(`includes ${route}`, () => {
      expect(() => readFileSync(path.join(process.cwd(), route), "utf8")).not.toThrow();
    });
  }
});

describe("calendar UI components", () => {
  const files = [
    "src/components/calendar/calendar-view.tsx",
    "src/components/calendar/calendar-month-grid.tsx",
    "src/components/calendar/calendar-week-grid.tsx",
    "src/components/calendar/calendar-list-view.tsx",
    "src/components/calendar/calendar-unscheduled-queue.tsx",
    "src/app/(dashboard)/calendar/page.tsx",
  ];

  for (const file of files) {
    it(`includes ${file}`, () => {
      const content = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(content.length).toBeGreaterThan(0);
      expect(content).not.toContain("ModuleEmptyState");
    });
  }
});

describe("external calendar contracts", () => {
  it("defines provider-independent integration contracts", () => {
    const content = readFileSync(
      path.join(process.cwd(), "src/lib/calendar/external-providers.ts"),
      "utf8",
    );
    expect(content).toContain("GOOGLE_CALENDAR");
    expect(content).toContain("MICROSOFT_OUTLOOK");
    expect(content).toContain("SOCIAL_PUBLISHING");
  });
});
