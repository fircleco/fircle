export type StorageDriver = "r2";

export type StorageCredentialCategory = "storage";

export type StorageCredentialProvider = "r2";

export type R2StorageCredential = {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
};

export type StorageConfigSource = "database" | "environment" | "disabled";

export type StorageConfigResolution = {
  category: StorageCredentialCategory;
  provider: StorageCredentialProvider;
  source: StorageConfigSource;
  isValid: boolean;
  config: R2StorageCredential | null;
};

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

  signReadUrl(object: StoredObjectRef, expiresInSeconds?: number): Promise<string>;

  buildReadUrl(object: StoredObjectRef): string;

  deleteObject(object: StoredObjectRef): Promise<void>;
}
