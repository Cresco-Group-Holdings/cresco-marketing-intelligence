import { createSupabaseServiceClient } from "@/lib/auth/supabase-service";
import { getClientEnv } from "@/lib/environment";
import { MARKETING_ASSET_DEFAULT_BUCKET } from "@/lib/marketing-assets/constants";
import type { ObjectStorageProvider, StorageSignedUrl, StorageUploadInput } from "@/lib/storage/types";

function getBucketName(): string {
  return process.env.SUPABASE_MARKETING_ASSETS_BUCKET?.trim() || MARKETING_ASSET_DEFAULT_BUCKET;
}

export class SupabaseObjectStorageProvider implements ObjectStorageProvider {
  async upload(input: StorageUploadInput): Promise<void> {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.storage.from(getBucketName()).upload(input.key, input.body, {
      contentType: input.contentType,
      upsert: false,
    });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.storage.from(getBucketName()).remove([key]);
    if (error) {
      throw new Error(`Storage delete failed: ${error.message}`);
    }
  }

  async createSignedUrl(key: string, expiresInSeconds: number): Promise<StorageSignedUrl> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.storage
      .from(getBucketName())
      .createSignedUrl(key, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(`Signed URL creation failed: ${error?.message ?? "Unknown error"}`);
    }

    return {
      url: data.signedUrl,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }
}

export function createObjectStorageProvider(): ObjectStorageProvider {
  if (process.env.MARKETING_ASSET_STORAGE_PROVIDER === "memory") {
    return createInMemoryObjectStorageProvider();
  }

  getClientEnv();
  return new SupabaseObjectStorageProvider();
}

type MemoryObject = {
  body: Buffer;
  contentType: string;
};

const memoryStore = new Map<string, MemoryObject>();

export function createInMemoryObjectStorageProvider(): ObjectStorageProvider {
  return {
    async upload(input: StorageUploadInput): Promise<void> {
      memoryStore.set(input.key, { body: input.body, contentType: input.contentType });
    },
    async delete(key: string): Promise<void> {
      memoryStore.delete(key);
    },
    async createSignedUrl(key: string, expiresInSeconds: number): Promise<StorageSignedUrl> {
      if (!memoryStore.has(key)) {
        throw new Error("Object not found in memory storage.");
      }

      return {
        url: `memory://${key}?expires=${expiresInSeconds}`,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      };
    },
  };
}

export function resetInMemoryObjectStorageForTests(): void {
  memoryStore.clear();
}

export function getInMemoryObjectForTests(key: string): MemoryObject | undefined {
  return memoryStore.get(key);
}
