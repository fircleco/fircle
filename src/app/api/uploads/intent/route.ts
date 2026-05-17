import { randomUUID } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getStorageProvider } from "~/server/storage";

const MAX_FILES_PER_POST = 10;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 250 * 1024 * 1024;

const ACCEPTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const ACCEPTED_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

const uploadIntentSchema = z.object({
  familyId: z.string().cuid(),
  files: z
    .array(
      z.object({
        fileName: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().toLowerCase().min(3).max(120),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(MAX_FILES_PER_POST),
});

type UploadIntentInput = z.infer<typeof uploadIntentSchema>;

function jsonError(
  status: number,
  code:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "BAD_REQUEST"
    | "UNSUPPORTED_MEDIA_TYPE"
    | "PAYLOAD_TOO_LARGE",
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

function getFileKind(mimeType: string): "image" | "video" | null {
  if (ACCEPTED_IMAGE_MIME_TYPES.has(mimeType)) {
    return "image";
  }
  if (ACCEPTED_VIDEO_MIME_TYPES.has(mimeType)) {
    return "video";
  }
  return null;
}

function sanitizePathSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-_.]/g, "-");
}

function getSafeExtension(fileName: string, mimeType: string) {
  const fromName = fileName.toLowerCase().match(/\.([a-z0-9]{2,10})$/)?.[1];
  if (fromName) {
    return fromName;
  }

  const fallbackByMimeType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };

  return fallbackByMimeType[mimeType] ?? "bin";
}

function buildObjectKey(input: {
  familyId: string;
  memberId: string;
  mimeType: string;
  fileName: string;
}) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const kind = input.mimeType.startsWith("video/") ? "video" : "image";
  const ext = sanitizePathSegment(getSafeExtension(input.fileName, input.mimeType));

  return [
    "families",
    sanitizePathSegment(input.familyId),
    "members",
    sanitizePathSegment(input.memberId),
    "posts",
    `${yyyy}/${mm}/${dd}`,
    kind,
    `${randomUUID()}.${ext}`,
  ].join("/");
}

function validateFileConstraints(file: UploadIntentInput["files"][number]) {
  const kind = getFileKind(file.mimeType);

  if (!kind) {
    return {
      ok: false as const,
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE" as const,
      message: `Unsupported mime type: ${file.mimeType}`,
    };
  }

  if (kind === "image" && file.sizeBytes > MAX_IMAGE_BYTES) {
    return {
      ok: false as const,
      status: 413,
      code: "PAYLOAD_TOO_LARGE" as const,
      message: `Image file exceeds max size of ${MAX_IMAGE_BYTES} bytes`,
    };
  }

  if (kind === "video" && file.sizeBytes > MAX_VIDEO_BYTES) {
    return {
      ok: false as const,
      status: 413,
      code: "PAYLOAD_TOO_LARGE" as const,
      message: `Video file exceeds max size of ${MAX_VIDEO_BYTES} bytes`,
    };
  }

  return {
    ok: true as const,
  };
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return jsonError(401, "UNAUTHORIZED", "Authentication required");
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = uploadIntentSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(400, "BAD_REQUEST", "Invalid upload intent payload", {
      issues: parsed.error.flatten(),
      limits: {
        maxFilesPerPost: MAX_FILES_PER_POST,
        maxImageBytes: MAX_IMAGE_BYTES,
        maxVideoBytes: MAX_VIDEO_BYTES,
      },
    });
  }

  const membership = await db.familyMember.findUnique({
    where: {
      familyId_userId: {
        familyId: parsed.data.familyId,
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

  for (const file of parsed.data.files) {
    const validation = validateFileConstraints(file);
    if (!validation.ok) {
      return jsonError(validation.status, validation.code, validation.message, {
        file,
        limits: {
          maxFilesPerPost: MAX_FILES_PER_POST,
          maxImageBytes: MAX_IMAGE_BYTES,
          maxVideoBytes: MAX_VIDEO_BYTES,
          acceptedMimeTypes: [
            ...ACCEPTED_IMAGE_MIME_TYPES.values(),
            ...ACCEPTED_VIDEO_MIME_TYPES.values(),
          ],
        },
      });
    }
  }

  const storage = getStorageProvider();
  const intents = await Promise.all(
    parsed.data.files.map(async (file) => {
      const objectKey = buildObjectKey({
        familyId: membership.familyId,
        memberId: membership.id,
        mimeType: file.mimeType,
        fileName: file.fileName,
      });

      const intent = await storage.signUpload({
        objectKey,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      });

      return {
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        ...intent,
      };
    }),
  );

  return NextResponse.json({
    intents,
    constraints: {
      maxFilesPerPost: MAX_FILES_PER_POST,
      maxImageBytes: MAX_IMAGE_BYTES,
      maxVideoBytes: MAX_VIDEO_BYTES,
      acceptedMimeTypes: [
        ...ACCEPTED_IMAGE_MIME_TYPES.values(),
        ...ACCEPTED_VIDEO_MIME_TYPES.values(),
      ],
    },
  });
}
