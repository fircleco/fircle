import imageCompression from "browser-image-compression";
import heic2any from "heic2any";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  compressImage,
  createInstantPreviewUrl,
  createPreviewUrl,
  resolveMediaMimeType,
  shouldUseServerVideoCompression,
} from "~/lib/media-compression";

vi.mock("browser-image-compression", () => ({
  default: vi.fn(),
}));

vi.mock("heic2any", () => ({
  default: vi.fn(),
}));

describe("media-compression", () => {
  const imageCompressionMock = vi.mocked(imageCompression);
  const heic2anyMock = vi.mocked(heic2any);
  const createObjectUrlMock = vi.fn<(blob: Blob) => string>();

  beforeEach(() => {
    vi.clearAllMocks();
    createObjectUrlMock.mockReset();
    createObjectUrlMock.mockImplementation(() => `blob:mock-${Math.random().toString(36).slice(2)}`);
    vi.stubGlobal(
      "URL",
      {
        createObjectURL: createObjectUrlMock,
      } as unknown as typeof URL,
    );
  });

  it("infers mime type from extension when file.type is blank", () => {
    const image = new File(["img"], "family.heic", { type: "" });
    const video = new File(["vid"], "clip.mp4", { type: "" });

    expect(resolveMediaMimeType(image)).toBe("image/heic");
    expect(resolveMediaMimeType(video)).toBe("video/mp4");
  });

  it("routes video files to server-side compression", () => {
    const file = new File(["video"], "clip.mov", { type: "" });
    expect(shouldUseServerVideoCompression(file)).toBe(true);
  });

  it("throws when trying to image-compress a non-image file", async () => {
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" });

    await expect(compressImage(file)).rejects.toThrow("Only image files can be compressed as images.");
  });

  it("normalizes HEIC to WebP and reports progress", async () => {
    const source = new File(["heic-bytes"], "memory.heic", { type: "image/heic" });
    const convertedBlob = new Blob(["converted"], { type: "image/webp" });
    const compressedBlob = new Blob(["compressed"], { type: "image/webp" });

    heic2anyMock.mockResolvedValue(convertedBlob);
    imageCompressionMock.mockImplementation(async (_file, options) => {
      options?.onProgress?.(67);
      return compressedBlob as File;
    });

    const progressValues: number[] = [];
    const compressed = await compressImage(source, (progress) => {
      progressValues.push(progress);
    });

    expect(heic2anyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        blob: source,
        toType: "image/webp",
      }),
    );
    expect(imageCompressionMock).toHaveBeenCalledTimes(1);
    expect(progressValues).toEqual([67]);
    expect(compressed.type).toBe("image/webp");
    expect(compressed.name).toBe("memory.webp");
  });

  it("creates fallback preview URL for non-HEIC images", async () => {
    const image = new File(["png"], "photo.png", { type: "image/png" });
    createObjectUrlMock.mockReturnValue("blob:png-preview");

    const url = await createPreviewUrl(image);

    expect(url).toBe("blob:png-preview");
    expect(heic2anyMock).not.toHaveBeenCalled();
  });

  it("returns immediate preview and upgrades HEIC preview asynchronously", async () => {
    const image = new File(["heic"], "photo.heic", { type: "image/heic" });
    const upgradedBlob = new Blob(["jpeg-preview"], { type: "image/jpeg" });

    createObjectUrlMock
      .mockReturnValueOnce("blob:immediate")
      .mockReturnValueOnce("blob:upgraded");
    heic2anyMock.mockResolvedValue(upgradedBlob);

    let upgradedUrl: string | null = null;
    const immediateUrl = createInstantPreviewUrl(image, (url) => {
      upgradedUrl = url;
    });

    expect(immediateUrl).toBe("blob:immediate");

    await vi.dynamicImportSettled();
    await Promise.resolve();
    await Promise.resolve();

    expect(heic2anyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        blob: image,
        toType: "image/jpeg",
      }),
    );
    expect(upgradedUrl).toBe("blob:upgraded");
  });

  it("upgrades HEIC preview when file.type is blank but extension is supported", async () => {
    const image = new File(["heic"], "photo.heic", { type: "" });
    const upgradedBlob = new Blob(["jpeg-preview"], { type: "image/jpeg" });

    createObjectUrlMock
      .mockReturnValueOnce("blob:immediate")
      .mockReturnValueOnce("blob:upgraded");
    heic2anyMock.mockResolvedValue(upgradedBlob);

    let upgradedUrl: string | null = null;
    const immediateUrl = createInstantPreviewUrl(image, (url) => {
      upgradedUrl = url;
    });

    expect(immediateUrl).toBe("blob:immediate");

    await vi.dynamicImportSettled();
    await Promise.resolve();
    await Promise.resolve();

    expect(heic2anyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        blob: image,
        toType: "image/jpeg",
      }),
    );
    expect(upgradedUrl).toBe("blob:upgraded");
  });
});
