import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_VIDEO_BYTES } from "~/server/storage/media-object-key";

const mocked = vi.hoisted(() => {
  return {
    auth: vi.fn(),
    findMembership: vi.fn(),
    transcodeVideoToMp4: vi.fn(),
    getStorageProvider: vi.fn(),
    mkdir: vi.fn(),
    readFile: vi.fn(),
    rm: vi.fn(),
    writeFile: vi.fn(),
  };
});

vi.mock("~/server/auth", () => ({
  auth: mocked.auth,
}));

vi.mock("~/server/db", () => ({
  db: {
    familyMember: {
      findUnique: mocked.findMembership,
    },
  },
}));

vi.mock("~/server/media/ffmpeg", () => ({
  transcodeVideoToMp4: mocked.transcodeVideoToMp4,
}));

vi.mock("~/server/storage", () => ({
  getStorageProvider: mocked.getStorageProvider,
}));

vi.mock("node:fs/promises", () => ({
  mkdir: mocked.mkdir,
  readFile: mocked.readFile,
  rm: mocked.rm,
  writeFile: mocked.writeFile,
}));

function createMultipartRequest(formData: FormData) {
  return {
    formData: async () => formData,
  };
}

describe("POST /api/uploads/video/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocked.mkdir.mockResolvedValue(undefined);
    mocked.rm.mockResolvedValue(undefined);
    mocked.writeFile.mockResolvedValue(undefined);
    mocked.readFile.mockResolvedValue(Buffer.from("compressed-video"));
    mocked.transcodeVideoToMp4.mockResolvedValue(undefined);
    mocked.getStorageProvider.mockReturnValue({
      signUpload: vi.fn().mockResolvedValue({
        provider: "r2",
        method: "PUT",
        uploadUrl: "https://storage.example/upload",
        requiredHeaders: {
          "content-type": "video/mp4",
        },
        expiresAt: new Date(),
        object: {
          provider: "r2",
          bucket: "family-media",
          objectKey: "families/family/members/member/posts/2026/05/31/video/video.mp4",
        },
        readUrl: "https://storage.example/read/video.mp4",
      }),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("", {
          status: 200,
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports node runtime for ffmpeg support", async () => {
    const route = await import("~/app/api/uploads/video/ingest/route");
    expect(route.runtime).toBe("nodejs");
  });

  it("returns 401 when user is not authenticated", async () => {
    mocked.auth.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("familyId", "clh0000000000000000000000");
    formData.set("file", new File(["video"], "clip.mp4", { type: "video/mp4" }));

    const { POST } = await import("~/app/api/uploads/video/ingest/route");
    const response = await POST(createMultipartRequest(formData) as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("returns 415 when mime type is not supported", async () => {
    mocked.auth.mockResolvedValue({
      user: { id: "user-1" },
    });

    const formData = new FormData();
    formData.set("familyId", "clh0000000000000000000000");
    formData.set("file", new File(["text"], "not-video.txt", { type: "text/plain" }));

    const { POST } = await import("~/app/api/uploads/video/ingest/route");
    const response = await POST(createMultipartRequest(formData) as never);

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNSUPPORTED_MEDIA_TYPE" },
    });
    expect(mocked.findMembership).not.toHaveBeenCalled();
  });

  it("returns 413 when video exceeds configured max size", async () => {
    mocked.auth.mockResolvedValue({
      user: { id: "user-1" },
    });

    const file = new File(["v"], "huge.mp4", {
      type: "video/mp4",
    });
    Object.defineProperty(file, "size", {
      value: MAX_VIDEO_BYTES + 1,
      configurable: true,
    });

    const formData = new FormData();
    formData.set("familyId", "clh0000000000000000000000");
    formData.set("file", file);

    const { POST } = await import("~/app/api/uploads/video/ingest/route");
    const response = await POST(createMultipartRequest(formData) as never);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PAYLOAD_TOO_LARGE" },
    });
    expect(mocked.findMembership).not.toHaveBeenCalled();
  });

  it("returns 403 when authenticated user is not in family", async () => {
    mocked.auth.mockResolvedValue({
      user: { id: "user-1" },
    });
    mocked.findMembership.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("familyId", "clh0000000000000000000000");
    formData.set("file", new File(["video"], "clip.mov", { type: "video/quicktime" }));

    const { POST } = await import("~/app/api/uploads/video/ingest/route");
    const response = await POST(createMultipartRequest(formData) as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });

  it("transcodes and uploads video, then returns uploaded metadata", async () => {
    mocked.auth.mockResolvedValue({
      user: { id: "user-1" },
    });
    mocked.findMembership.mockResolvedValue({
      id: "member-1",
      familyId: "clh0000000000000000000000",
    });

    const formData = new FormData();
    formData.set("familyId", "clh0000000000000000000000");
    formData.set("file", new File(["video-data"], "trip.mov", { type: "video/quicktime" }));

    const { POST } = await import("~/app/api/uploads/video/ingest/route");
    const response = await POST(createMultipartRequest(formData) as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocked.transcodeVideoToMp4).toHaveBeenCalledTimes(1);

    const storage = mocked.getStorageProvider.mock.results[0]?.value as {
      signUpload: ReturnType<typeof vi.fn>;
    };

    expect(storage.signUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        mimeType: "video/mp4",
        sizeBytes: Buffer.from("compressed-video").byteLength,
      }),
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://storage.example/upload",
      expect.objectContaining({
        method: "PUT",
      }),
    );

    expect(payload).toMatchObject({
      media: {
        provider: "r2",
        bucket: "family-media",
        mimeType: "video/mp4",
        url: "https://storage.example/read/video.mp4",
        sizeBytes: Buffer.from("compressed-video").byteLength,
      },
    });
    expect(mocked.rm).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when transcoding fails and still cleans temp files", async () => {
    mocked.auth.mockResolvedValue({
      user: { id: "user-1" },
    });
    mocked.findMembership.mockResolvedValue({
      id: "member-1",
      familyId: "clh0000000000000000000000",
    });
    mocked.transcodeVideoToMp4.mockRejectedValue(new Error("ffmpeg error"));

    const formData = new FormData();
    formData.set("familyId", "clh0000000000000000000000");
    formData.set("file", new File(["video"], "clip.mp4", { type: "video/mp4" }));

    const { POST } = await import("~/app/api/uploads/video/ingest/route");
    const response = await POST(createMultipartRequest(formData) as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
    expect(mocked.rm).toHaveBeenCalledTimes(1);
  });
});
