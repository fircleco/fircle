import "server-only";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "~/env";

import type {
  StoredObjectRef,
  StorageProvider,
  UploadIntentRequest,
  UploadIntentResponse,
} from "./types";

const DEFAULT_UPLOAD_EXPIRY_SECONDS = 300;

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function sanitizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export class R2StorageProvider implements StorageProvider {
  public readonly driver = "r2" as const;

  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly client: S3Client;

  public constructor() {
    if (env.STORAGE_DRIVER !== "r2") {
      throw new Error("R2StorageProvider requires STORAGE_DRIVER=r2");
    }

    this.bucket = env.R2_BUCKET;
    this.publicBaseUrl = sanitizeBaseUrl(env.R2_PUBLIC_BASE_URL);
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  public async signUpload(input: UploadIntentRequest): Promise<UploadIntentResponse> {
    const normalizedKey = trimSlashes(input.objectKey);
    const expiresIn = Math.max(30, input.expiresInSeconds ?? DEFAULT_UPLOAD_EXPIRY_SECONDS);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: normalizedKey,
      ContentType: input.mimeType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    const object: StoredObjectRef = {
      provider: this.driver,
      bucket: this.bucket,
      objectKey: normalizedKey,
    };

    return {
      provider: this.driver,
      method: "PUT",
      uploadUrl,
      requiredHeaders: {
        "content-type": input.mimeType,
      },
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      object,
      readUrl: this.buildReadUrl(object),
    };
  }

  public buildReadUrl(object: StoredObjectRef): string {
    if (object.provider !== this.driver) {
      throw new Error(`Unsupported provider: ${object.provider}`);
    }
    if (object.bucket !== this.bucket) {
      throw new Error(`Unexpected bucket for R2 object: ${object.bucket}`);
    }

    const key = trimSlashes(object.objectKey);
    return `${this.publicBaseUrl}/${key}`;
  }

  public async deleteObject(object: StoredObjectRef): Promise<void> {
    if (object.provider !== this.driver) {
      throw new Error(`Unsupported provider: ${object.provider}`);
    }

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: object.bucket,
        Key: trimSlashes(object.objectKey),
      }),
    );
  }
}
