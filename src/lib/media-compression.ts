import imageCompression from "browser-image-compression";

const IMAGE_MAX_DIMENSION = 2048;
const IMAGE_QUALITY = 0.85;
const IMAGE_PREVIEW_QUALITY = 0.5;
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

type Heic2Any = typeof import("heic2any").default;

function getExtension(fileName: string) {
  const extension = /\.([a-z0-9]{2,10})$/i.exec(fileName)?.[1];
  return extension?.toLowerCase();
}

function toWebpName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return `${baseName || "image"}.webp`;
}

export function resolveMediaMimeType(file: File) {
  const currentType = file.type.trim().toLowerCase();
  if (currentType.length > 0) {
    return currentType;
  }

  const extension = getExtension(file.name);
  return extension ? (MIME_BY_EXTENSION[extension] ?? "application/octet-stream") : "application/octet-stream";
}

async function loadHeic2Any(): Promise<Heic2Any> {
  const heic2anyModule = await import("heic2any");
  return heic2anyModule.default;
}

export async function compressImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<File> {
  const resolvedMimeType = resolveMediaMimeType(file);

  if (!resolvedMimeType.startsWith("image/")) {
    throw new Error("Only image files can be compressed as images.");
  }

  const fileForCompression =
    resolvedMimeType === "image/heic" || resolvedMimeType === "image/heif"
      ? await (async () => {
          const heic2any = await loadHeic2Any();
          const converted = await heic2any({
            blob: file,
            toType: "image/webp",
            quality: IMAGE_QUALITY,
          });

          const webpBlob = Array.isArray(converted) ? converted[0] : converted;
          if (!(webpBlob instanceof Blob)) {
            throw new Error("HEIC conversion produced an invalid result.");
          }

          return new File([webpBlob], toWebpName(file.name), {
            type: "image/webp",
            lastModified: Date.now(),
          });
        })()
      : file;

  const compressed = await imageCompression(fileForCompression, {
    maxWidthOrHeight: IMAGE_MAX_DIMENSION,
    initialQuality: IMAGE_QUALITY,
    fileType: "image/webp",
    useWebWorker: true,
    onProgress,
  });

  return new File([compressed], toWebpName(file.name), {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

export async function createPreviewUrl(file: File): Promise<string> {
  const resolvedMimeType = resolveMediaMimeType(file);
  if (resolvedMimeType !== "image/heic" && resolvedMimeType !== "image/heif") {
    return URL.createObjectURL(file);
  }

  try {
    const heic2any = await loadHeic2Any();
    const converted = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: IMAGE_PREVIEW_QUALITY,
    });

    const previewBlob = Array.isArray(converted) ? converted[0] : converted;
    if (!(previewBlob instanceof Blob)) {
      return URL.createObjectURL(file);
    }

    return URL.createObjectURL(previewBlob);
  } catch {
    return URL.createObjectURL(file);
  }
}

export function createInstantPreviewUrl(
  file: File,
  onUpgradedPreviewUrl?: (upgradedUrl: string) => void,
  onPreviewUpgradeFailed?: () => void,
): string {
  const immediatePreviewUrl = URL.createObjectURL(file);
  const resolvedMimeType = resolveMediaMimeType(file);

  if (resolvedMimeType !== "image/heic" && resolvedMimeType !== "image/heif") {
    return immediatePreviewUrl;
  }

  void (async () => {
    try {
      const heic2any = await loadHeic2Any();
      const converted = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: IMAGE_PREVIEW_QUALITY,
      });

      const previewBlob = Array.isArray(converted) ? converted[0] : converted;
      if (!(previewBlob instanceof Blob)) {
        onPreviewUpgradeFailed?.();
        return;
      }

      onUpgradedPreviewUrl?.(URL.createObjectURL(previewBlob));
    } catch {
      onPreviewUpgradeFailed?.();
      // Keep the immediate preview URL when HEIC conversion fails.
    }
  })();

  return immediatePreviewUrl;
}

export function shouldUseServerVideoCompression(file: File) {
  return resolveMediaMimeType(file).startsWith("video/");
}
