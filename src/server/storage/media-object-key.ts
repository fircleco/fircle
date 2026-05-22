import { randomUUID } from "node:crypto";

export const MAX_FILES_PER_POST = 10;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 250 * 1024 * 1024;

export const ACCEPTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const ACCEPTED_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export type MediaFileConstraintInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type MediaFileConstraintResult =
  | { ok: true }
  | {
      ok: false;
      status: 415 | 413;
      code: "UNSUPPORTED_MEDIA_TYPE" | "PAYLOAD_TOO_LARGE";
      message: string;
    };

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

export function getMediaKind(mimeType: string): "image" | "video" | null {
  if (ACCEPTED_IMAGE_MIME_TYPES.has(mimeType)) {
    return "image";
  }
  if (ACCEPTED_VIDEO_MIME_TYPES.has(mimeType)) {
    return "video";
  }
  return null;
}

export function buildMediaObjectKey(input: {
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

export function buildAvatarObjectKey(input: {
  familyId: string;
  memberId: string;
  mimeType: string;
  fileName: string;
}) {
  const ext = sanitizePathSegment(getSafeExtension(input.fileName, input.mimeType));

  return [
    "families",
    sanitizePathSegment(input.familyId),
    "members",
    sanitizePathSegment(input.memberId),
    "avatars",
    `${randomUUID()}.${ext}`,
  ].join("/");
}

export function buildFamilyImageObjectKey(input: {
  familyId: string;
  mimeType: string;
  fileName: string;
}) {
  const ext = sanitizePathSegment(getSafeExtension(input.fileName, input.mimeType));

  return [
    "families",
    sanitizePathSegment(input.familyId),
    "identity",
    `${randomUUID()}.${ext}`,
  ].join("/");
}

export function validateMediaFileConstraints(
  file: MediaFileConstraintInput,
): MediaFileConstraintResult {
  const kind = getMediaKind(file.mimeType);

  if (!kind) {
    return {
      ok: false,
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
      message: `Unsupported mime type: ${file.mimeType}`,
    };
  }

  if (kind === "image" && file.sizeBytes > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      message: `Image file exceeds max size of ${MAX_IMAGE_BYTES} bytes`,
    };
  }

  if (kind === "video" && file.sizeBytes > MAX_VIDEO_BYTES) {
    return {
      ok: false,
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      message: `Video file exceeds max size of ${MAX_VIDEO_BYTES} bytes`,
    };
  }

  return { ok: true };
}
