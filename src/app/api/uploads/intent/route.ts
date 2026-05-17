import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getStorageProvider } from "~/server/storage";
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  ACCEPTED_VIDEO_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  MAX_FILES_PER_POST,
  buildMediaObjectKey,
  validateMediaFileConstraints,
} from "~/server/storage/media-object-key";

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

function validateFileConstraints(file: UploadIntentInput["files"][number]) {
  return validateMediaFileConstraints(file);
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
      const objectKey = buildMediaObjectKey({
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
