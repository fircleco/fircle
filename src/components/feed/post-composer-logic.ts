import type { ComposerOpenMode } from "./composer-entry";

export type ComposerSelectedMedia = {
  uploadError: string | null;
};

export function canPublishComposerPost(input: {
  familyId?: string;
  caption: string;
  selectedMedia: ComposerSelectedMedia[];
  isUploading: boolean;
  isPending: boolean;
}) {
  if (!input.familyId || input.isUploading || input.isPending) {
    return false;
  }

  const hasContent = input.caption.trim().length > 0 || input.selectedMedia.length > 0;
  const hasUploadErrors = input.selectedMedia.some((item) => item.uploadError);
  return hasContent && !hasUploadErrors;
}

export function resolveComposerMediaType(modes: ComposerOpenMode[] | undefined) {
  const hasPhoto = modes?.includes("photo") ?? false;
  const hasVideo = modes?.includes("video") ?? false;

  if (hasPhoto && hasVideo) {
    return "MIXED" as const;
  }
  if (hasVideo) {
    return "VIDEO" as const;
  }
  if (hasPhoto) {
    return "PHOTO" as const;
  }
  return "TEXT" as const;
}
