import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureUserProfile } from "@/lib/auth/provisioning";

const store = new Map<string, Record<string, unknown>>();

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    userProfile: {
      findUnique: vi.fn(async ({ where }: { where: { authUserId: string } }) => {
        return store.get(where.authUserId) ?? null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const profile = {
          id: `profile-${store.size + 1}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.set(String(data.authUserId), profile);
        return profile;
      }),
      update: vi.fn(async ({ where, data }: { where: { authUserId: string }; data: Record<string, unknown> }) => {
        const existing = store.get(where.authUserId);
        if (!existing) {
          throw new Error("not found");
        }
        const updated = { ...existing, ...data, updatedAt: new Date() };
        store.set(where.authUserId, updated);
        return updated;
      }),
    },
  },
}));

describe("profile provisioning idempotency", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("creates a profile on first login", async () => {
    const result = await ensureUserProfile({
      authUserId: "auth-1",
      email: "User@Example.com",
      displayName: "User Example",
      firstName: "User",
      lastName: "Example",
    });

    expect(result.created).toBe(true);
    expect(result.email).toBe("user@example.com");
    expect(result.profile.displayName).toBe("User Example");
  });

  it("does not overwrite user-edited profile fields on repeat login", async () => {
    await ensureUserProfile({
      authUserId: "auth-1",
      email: "user@example.com",
      displayName: "Initial Name",
      firstName: "Initial",
      lastName: "Name",
    });

    store.set("auth-1", {
      ...store.get("auth-1")!,
      displayName: "Edited Name",
      firstName: "Edited",
      lastName: "Profile",
    });

    const result = await ensureUserProfile({
      authUserId: "auth-1",
      email: "user@example.com",
      displayName: "Provider Name",
      firstName: "Provider",
      lastName: "Metadata",
    });

    expect(result.created).toBe(false);
    expect(result.profile.displayName).toBe("Edited Name");
    expect(result.profile.firstName).toBe("Edited");
    expect(result.profile.lastName).toBe("Profile");
  });
});
