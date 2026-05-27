import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { transcodeVideoToMp4 } from "~/server/media/ffmpeg";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getStorageProvider } from "~/server/storage";
import {
  ACCEPTED_VIDEO_MIME_TYPES,
  MAX_VIDEO_BYTES,
  buildMediaObjectKey,
  validateMediaFileConstraints,
} from "~/server/storage/media-object-key";

const ingestPayloadSchema = z.object({
  familyId: z.string().cuid(),
});

const MAX_TRANSCODED_UPLOAD_ATTEMPTS = 3;

export const runtime = "nodejs";

function jsonError(
  status: number,
  code:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "BAD_REQUEST"
    | "UNSUPPORTED_MEDIA_TYPE"
    | "PAYLOAD_TOO_LARGE"
    | "INTERNAL_SERVER_ERROR",
  message: string,
  details?: unknown,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    },
    { status },
  );
}

function sanitizeFileBase(fileName: string) {
  const stem = basename(fileName, extname(fileName));
  const normalized = stem.toLowerCase().replace(/[^a-z0-9-_.]/g, "-");
  return normalized.length > 0 ? normalized : "video";
}

function sanitizeInputExtension(fileName: string) {
  const ext = extname(fileName).toLowerCase().replace(/[^a-z0-9.]/g, "");
  if (ext.length < 2 || ext.length > 12) {
    return ".bin";
  }
  return ext;
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unknown error";
  }

  const parts = [error.message];

  const cause = error.cause;
  if (cause instanceof Error) {
    const nested = [cause.message];
    const causeCode =
      "code" in cause && typeof cause.code === "string" ? cause.code : undefined;
    if (causeCode) {
      nested.push(`code=${causeCode}`);
    }
    parts.push(`cause: ${nested.join(" ")}`);
  }

  return parts.join(" | ");
}

function isRetryableUploadError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = describeError(error);
  return /(UND_ERR_SOCKET|fetch failed|ECONNRESET|ETIMEDOUT|EPIPE|other side closed)/i.test(
    message,
  );
}

async function uploadTranscodedVideo(input: {
  objectKey: string;
  buffer: Buffer;
}) {
  const storage = getStorageProvider();
  const mimeType = "video/mp4";

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_TRANSCODED_UPLOAD_ATTEMPTS; attempt += 1) {
    const intent = await storage.signUpload({
      objectKey: input.objectKey,
      mimeType,
      sizeBytes: input.buffer.byteLength,
    });

    const uploadTarget = new URL(intent.uploadUrl);
    const targetSummary = `${uploadTarget.origin}${uploadTarget.pathname}`;

    try {
      const uploadResponse = await fetch(intent.uploadUrl, {
        method: "PUT",
        headers: intent.requiredHeaders,
        body: input.buffer as unknown as BodyInit,
      });

      if (!uploadResponse.ok) {
        const responseBody = await uploadResponse.text().catch(() => "");
        const bodySnippet = responseBody.trim().slice(0, 300);
        throw new Error(
          `Transcoded video upload failed for ${targetSummary} with status ${uploadResponse.status}${
            bodySnippet ? ` body=${bodySnippet}` : ""
          }`,
        );
      }

      return {
        provider: intent.object.provider,
        bucket: intent.object.bucket,
        objectKey: intent.object.objectKey,
        url: intent.readUrl,
        mimeType,
        sizeBytes: input.buffer.byteLength,
      };
    } catch (error) {
      const wrappedError = new Error(
        `Transcoded video upload request failed for ${targetSummary} on attempt ${attempt}/${MAX_TRANSCODED_UPLOAD_ATTEMPTS}. ${describeError(
          error,
        )}`,
        {
          cause: error instanceof Error ? error : undefined,
        },
      );

      lastError = wrappedError;
      if (attempt === MAX_TRANSCODED_UPLOAD_ATTEMPTS || !isRetryableUploadError(error)) {
        throw wrappedError;
      }
    }
  }

  throw lastError ?? new Error("Transcoded video upload failed before any upload attempt completed.");
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return jsonError(401, "UNAUTHORIZED", "Authentication required");
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return jsonError(400, "BAD_REQUEST", "Invalid multipart payload");
  }

  const parsedPayload = ingestPayloadSchema.safeParse({
    familyId: formData.get("familyId"),
  });

  if (!parsedPayload.success) {
    return jsonError(400, "BAD_REQUEST", "Invalid ingest payload", {
      issues: parsedPayload.error.flatten(),
    });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError(400, "BAD_REQUEST", "A single video file is required");
  }

  const normalizedMimeType = file.type.trim().toLowerCase();
  if (!ACCEPTED_VIDEO_MIME_TYPES.has(normalizedMimeType)) {
    return jsonError(415, "UNSUPPORTED_MEDIA_TYPE", "Unsupported video mime type", {
      mimeType: normalizedMimeType,
      acceptedVideoMimeTypes: [...ACCEPTED_VIDEO_MIME_TYPES.values()],
    });
  }

  const constraintCheck = validateMediaFileConstraints({
    fileName: file.name,
    mimeType: normalizedMimeType,
    sizeBytes: file.size,
  });

  if (!constraintCheck.ok) {
    return jsonError(constraintCheck.status, constraintCheck.code, constraintCheck.message, {
      maxVideoBytes: MAX_VIDEO_BYTES,
    });
  }

  const membership = await db.familyMember.findUnique({
    where: {
      familyId_userId: {
        familyId: parsedPayload.data.familyId,
        userId: session.user.id,
      },
    },
    select: {
      id: true,
      familyId: true,
    },
  });

  if (!membership) {
    return jsonError(403, "FORBIDDEN", "You do not have access to this family");
  }

  const tempRoot = join(tmpdir(), "fircle-video-ingest", randomUUID());
  const inputPath = join(tempRoot, `input${sanitizeInputExtension(file.name)}`);
  const outputPath = join(tempRoot, "output.mp4");

  try {
    await mkdir(tempRoot, { recursive: true });

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, inputBuffer);

    await transcodeVideoToMp4(inputPath, outputPath);

    const outputBuffer = await readFile(outputPath);
    const mp4Name = `${sanitizeFileBase(file.name)}.mp4`;
    const objectKey = buildMediaObjectKey({
      familyId: membership.familyId,
      memberId: membership.id,
      mimeType: "video/mp4",
      fileName: mp4Name,
    });

    const uploadedMedia = await uploadTranscodedVideo({
      objectKey,
      buffer: outputBuffer,
    });

    return NextResponse.json({
      media: uploadedMedia,
    });
  } catch (error) {
    console.error("[video-ingest] Video processing failed", error);
    return jsonError(500, "INTERNAL_SERVER_ERROR", "Video processing failed", {
      message: describeError(error),
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}
