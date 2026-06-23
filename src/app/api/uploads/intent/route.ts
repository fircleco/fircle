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
  buildAvatarObjectKey,
  buildFamilyImageObjectKey,
  buildMediaObjectKey,
  getMediaKind,
  validateMediaFileConstraints,
} from "~/server/storage/media-object-key";

const uploadIntentSchema = z.object({
  familyId: z.string().cuid(),
  uploadFor: z.enum(["post", "avatar", "family-image"]).default("post"),
  memberId: z.string().cuid().optional(),
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
    | "NOT_FOUND"
    | "BAD_REQUEST"
    | "UNSUPPORTED_MEDIA_TYPE"
    | "SERVICE_UNAVAILABLE"
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

function getConstraintPayload(uploadFor: UploadIntentInput["uploadFor"]) {
  return {
    uploadFor,
    maxFilesPerPost: MAX_FILES_PER_POST,
    maxAvatarFiles: 1,
    maxImageBytes: MAX_IMAGE_BYTES,
    maxVideoBytes: MAX_VIDEO_BYTES,
    acceptedImageMimeTypes: [...ACCEPTED_IMAGE_MIME_TYPES.values()],
    acceptedVideoMimeTypes: [...ACCEPTED_VIDEO_MIME_TYPES.values()],
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
      limits: getConstraintPayload("post"),
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
      role: true,
    },
  });

  if (!membership) {
    return jsonError(403, "FORBIDDEN", "You do not have access to this family");
  }

  const { uploadFor } = parsed.data;

  if ((uploadFor === "avatar" || uploadFor === "family-image") && parsed.data.files.length !== 1) {
    return jsonError(400, "BAD_REQUEST", `${uploadFor} uploads support exactly one file`, {
      limits: getConstraintPayload(uploadFor),
    });
  }

  let targetMemberId = membership.id;

  if (uploadFor === "avatar") {
    if (!parsed.data.memberId) {
      return jsonError(400, "BAD_REQUEST", "memberId is required for avatar uploads", {
        limits: getConstraintPayload(uploadFor),
      });
    }

    const targetMember = await db.familyMember.findUnique({
      where: { id: parsed.data.memberId },
      select: { id: true, familyId: true },
    });

    if (targetMember?.familyId !== membership.familyId) {
      return jsonError(404, "NOT_FOUND", "Target member was not found in this family");
    }

    const isSelf = membership.id === targetMember.id;
    const isAdmin = membership.role === "ADMIN" || membership.role === "OWNER";

    if (!isSelf && !isAdmin) {
      return jsonError(403, "FORBIDDEN", "You do not have permission to upload this avatar");
    }

    targetMemberId = targetMember.id;
  }

  if (uploadFor === "family-image") {
    const isAdmin = membership.role === "ADMIN" || membership.role === "OWNER";

    if (!isAdmin) {
      return jsonError(403, "FORBIDDEN", "You do not have permission to upload a family image");
    }
  }

  for (const file of parsed.data.files) {
    if (uploadFor === "avatar" || uploadFor === "family-image") {
      const mediaKind = getMediaKind(file.mimeType);
      if (mediaKind !== "image") {
        return jsonError(415, "UNSUPPORTED_MEDIA_TYPE", "This upload must be an image", {
          file,
          limits: getConstraintPayload(uploadFor),
        });
      }
    }

    const validation = validateFileConstraints(file);
    if (!validation.ok) {
      return jsonError(validation.status, validation.code, validation.message, {
        file,
        limits: getConstraintPayload(uploadFor),
      });
    }
  }

  let storage;
  try {
    storage = await getStorageProvider(parsed.data.familyId);
  } catch (error) {
    return jsonError(503, "SERVICE_UNAVAILABLE", error instanceof Error ? error.message : "Storage is not configured");
  }

  const intents = await Promise.all(
    parsed.data.files.map(async (file) => {
      const objectKey =
        uploadFor === "avatar"
          ? buildAvatarObjectKey({
              familyId: membership.familyId,
              memberId: targetMemberId,
              mimeType: file.mimeType,
              fileName: file.fileName,
            })
          : uploadFor === "family-image"
            ? buildFamilyImageObjectKey({
                familyId: membership.familyId,
                mimeType: file.mimeType,
                fileName: file.fileName,
              })
          : buildMediaObjectKey({
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
    constraints: getConstraintPayload(uploadFor),
  });
}
