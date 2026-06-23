import "server-only";

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type {
  R2StorageCredential,
  StoredObjectRef,
  StorageProvider,
  UploadIntentRequest,
  UploadIntentResponse,
} from "./types";

const DEFAULT_UPLOAD_EXPIRY_SECONDS = 300;
const DEFAULT_READ_EXPIRY_SECONDS = 300;

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value);
}

function encodePath(value: string) {
  return trimSlashes(value)
    .split("/")
    .map((segment) => encodePathSegment(segment))
    .join("/");
}

export class R2StorageProvider implements StorageProvider {
  public readonly driver = "r2" as const;

  private readonly bucket: string;
  private readonly client: S3Client;

  public constructor(config: R2StorageCredential) {
    const { accountId, bucket, accessKeyId, secretAccessKey } = config;

    this.bucket = bucket;

    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
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

  public async signReadUrl(object: StoredObjectRef, expiresInSeconds?: number): Promise<string> {
    if (object.provider !== this.driver) {
      throw new Error(`Unsupported provider: ${String(object.provider)}`);
    }

    const expiresIn = Math.max(30, expiresInSeconds ?? DEFAULT_READ_EXPIRY_SECONDS);
    const command = new GetObjectCommand({
      Bucket: object.bucket,
      Key: trimSlashes(object.objectKey),
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  public buildReadUrl(object: StoredObjectRef): string {
    if (object.provider !== this.driver) {
      throw new Error(`Unsupported provider: ${String(object.provider)}`);
    }
    if (object.bucket !== this.bucket) {
      throw new Error(`Unexpected bucket for R2 object: ${object.bucket}`);
    }
    const key = encodePath(object.objectKey);
    return `/api/media/r2/${encodePathSegment(object.bucket)}/${key}`;
  }

  public async deleteObject(object: StoredObjectRef): Promise<void> {
    if (object.provider !== this.driver) {
      throw new Error(`Unsupported provider: ${String(object.provider)}`);
    }

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: object.bucket,
        Key: trimSlashes(object.objectKey),
      }),
    );
  }
}
