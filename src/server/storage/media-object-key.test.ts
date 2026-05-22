import { describe, expect, it } from "vitest";

import {
  buildAvatarObjectKey,
  buildFamilyImageObjectKey,
  buildMediaObjectKey,
  validateMediaFileConstraints,
} from "~/server/storage/media-object-key";

describe("buildMediaObjectKey", () => {
  it("scopes keys by family, member, date, and media kind", () => {
    const key = buildMediaObjectKey({
      familyId: "clh0000000000000000000000",
      memberId: "clh0000000000000000000001",
      mimeType: "image/jpeg",
      fileName: "family-photo.jpg",
    });

    expect(key).toMatch(
      /^families\/clh0000000000000000000000\/members\/clh0000000000000000000001\/posts\/\d{4}\/\d{2}\/\d{2}\/image\/[0-9a-f-]{36}\.jpg$/,
    );
  });

  it("uses a fallback extension when the filename does not include one", () => {
    const key = buildMediaObjectKey({
      familyId: "clh0000000000000000000000",
      memberId: "clh0000000000000000000001",
      mimeType: "video/mp4",
      fileName: "recital",
    });

    expect(key).toMatch(/\.mp4$/);
  });
});

describe("validateMediaFileConstraints", () => {
  it("accepts supported image uploads within size limits", () => {
    expect(
      validateMediaFileConstraints({
        fileName: "family.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects unsupported mime types", () => {
    const result = validateMediaFileConstraints({
      fileName: "document.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    }
  });

  it("rejects oversized video uploads", () => {
    const result = validateMediaFileConstraints({
      fileName: "video.mp4",
      mimeType: "video/mp4",
      sizeBytes: 250 * 1024 * 1024 + 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PAYLOAD_TOO_LARGE");
      expect(result.status).toBe(413);
    }
  });
});

describe("buildAvatarObjectKey", () => {
  it("scopes avatar keys by family and member with avatar segment", () => {
    const key = buildAvatarObjectKey({
      familyId: "clh0000000000000000000000",
      memberId: "clh0000000000000000000001",
      mimeType: "image/webp",
      fileName: "avatar.webp",
    });

    expect(key).toMatch(
      /^families\/clh0000000000000000000000\/members\/clh0000000000000000000001\/avatars\/[0-9a-f-]{36}\.webp$/,
    );
  });
});

describe("buildFamilyImageObjectKey", () => {
  it("scopes family identity image keys by family", () => {
    const key = buildFamilyImageObjectKey({
      familyId: "clh0000000000000000000000",
      mimeType: "image/png",
      fileName: "family-logo.png",
    });

    expect(key).toMatch(
      /^families\/clh0000000000000000000000\/identity\/[0-9a-f-]{36}\.png$/,
    );
  });
});
