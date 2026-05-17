import { describe, expect, it } from "vitest";

import { canPublishComposerPost, resolveComposerMediaType } from "./post-composer-logic";

describe("canPublishComposerPost", () => {
  it("allows text-only posts when a family context and caption are present", () => {
    expect(
      canPublishComposerPost({
        familyId: "clh0000000000000000000000",
        caption: "A simple memory",
        selectedMedia: [],
        isUploading: false,
        isPending: false,
      }),
    ).toBe(true);
  });

  it("blocks publish when any selected media has an upload error", () => {
    expect(
      canPublishComposerPost({
        familyId: "clh0000000000000000000000",
        caption: "Summer day",
        selectedMedia: [{ uploadError: "Network error while uploading media" }],
        isUploading: false,
        isPending: false,
      }),
    ).toBe(false);
  });

  it("blocks publish while uploads are in progress", () => {
    expect(
      canPublishComposerPost({
        familyId: "clh0000000000000000000000",
        caption: "Summer day",
        selectedMedia: [],
        isUploading: true,
        isPending: false,
      }),
    ).toBe(false);
  });
});

describe("resolveComposerMediaType", () => {
  it("maps no shortcuts to TEXT", () => {
    expect(resolveComposerMediaType(undefined)).toBe("TEXT");
  });

  it("maps photo shortcut to PHOTO", () => {
    expect(resolveComposerMediaType(["photo"])).toBe("PHOTO");
  });

  it("maps mixed shortcuts to MIXED", () => {
    expect(resolveComposerMediaType(["photo", "video"])).toBe("MIXED");
  });
});
