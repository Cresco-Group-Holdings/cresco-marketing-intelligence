export type StorageUploadInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export type StorageSignedUrl = {
  url: string;
  expiresAt: Date;
};

export interface ObjectStorageProvider {
  upload(input: StorageUploadInput): Promise<void>;
  delete(key: string): Promise<void>;
  createSignedUrl(key: string, expiresInSeconds: number): Promise<StorageSignedUrl>;
}
