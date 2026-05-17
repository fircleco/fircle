export type StorageDriver = "r2";

export type StoredObjectRef = {
  provider: StorageDriver;
  bucket: string;
  objectKey: string;
};

export type UploadIntentRequest = {
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  expiresInSeconds?: number;
};

export type UploadIntentResponse = {
  provider: StorageDriver;
  method: "PUT";
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: Date;
  object: StoredObjectRef;
  readUrl: string;
};

export interface StorageProvider {
  readonly driver: StorageDriver;

  signUpload(input: UploadIntentRequest): Promise<UploadIntentResponse>;

  buildReadUrl(object: StoredObjectRef): string;

  deleteObject(object: StoredObjectRef): Promise<void>;
}
