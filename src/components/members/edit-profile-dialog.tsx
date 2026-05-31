"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Camera, Loader, User, X } from "~/components/ui/icons";
import { Input } from "~/components/ui/input";
import type { FamilyMemberProfile } from "~/lib/mocks/family-members";
import { compressImage, createInstantPreviewUrl, resolveMediaMimeType } from "~/lib/media-compression";
import { api } from "~/trpc/react";

type EditProfileDialogProps = {
  member: FamilyMemberProfile;
  familyId?: string;
  triggerText?: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
  triggerClassName?: string;
};

type EditProfileFormState = {
  name: string;
  avatarUrl: string;
};

type UploadIntentItem = {
  provider: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  object: {
    provider: string;
    bucket: string;
    objectKey: string;
  };
  readUrl: string;
};

const ACCEPTED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_AVATAR_BYTES = 15 * 1024 * 1024;

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getUploadErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Upload failed. Please try again.";
}

function uploadFileWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
      onProgress(percent);
    };

    xhr.onerror = () => {
      reject(
        new Error(
          "Network error while uploading avatar. Check storage CORS and signed upload URL configuration.",
        ),
      );
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(new Error(`Upload failed with status ${xhr.status}`));
    };

    xhr.send(file);
  });
}

export function EditProfileDialog({
  member,
  familyId,
  triggerText = "Edit profile",
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerClassName,
}: EditProfileDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isPreviewConverting, setIsPreviewConverting] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [selectedAvatarPreviewUrl, setSelectedAvatarPreviewUrl] = useState<string | null>(null);
  const [form, setForm] = useState<EditProfileFormState>({
    name: member.name,
    avatarUrl: member.avatarUrl ?? "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarPreviewSelectionRef = useRef(0);
  const trpcUtils = api.useUtils();
  const updateProfile = api.familyMember.updateMemberProfile.useMutation();

  useEffect(() => {
    if (!open) return;

    setForm({
      name: member.name,
      avatarUrl: member.avatarUrl ?? "",
    });
    setSaveError(null);
    setUploadProgress(0);
    setIsPreviewConverting(false);
    setSelectedAvatarFile(null);
    setSelectedAvatarPreviewUrl((previousPreviewUrl) => {
      if (previousPreviewUrl) {
        URL.revokeObjectURL(previousPreviewUrl);
      }
      return null;
    });
  }, [member, open]);

  useEffect(() => {
    return () => {
      if (selectedAvatarPreviewUrl) {
        URL.revokeObjectURL(selectedAvatarPreviewUrl);
      }
    };
  }, [selectedAvatarPreviewUrl]);

  useEffect(() => {
    if (!open) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isSaving, open]);

  const previewInitials = useMemo(() => getInitials(form.name || member.name), [form.name, member.name]);
  const avatarPreviewUrl = selectedAvatarPreviewUrl ?? form.avatarUrl;

  const closeDialog = () => {
    if (isSaving) return;
    setOpen(false);
  };

  const handleAvatarSelected = (file: File | null) => {
    if (!file) {
      return;
    }

    setSaveError(null);

    if (!ACCEPTED_AVATAR_MIME_TYPES.has(resolveMediaMimeType(file))) {
      setSaveError("Please select a supported image format (jpg, png, webp, heic, heif).");
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setSaveError("Avatar image exceeds the 15MB size limit.");
      return;
    }

    if (selectedAvatarPreviewUrl) {
      URL.revokeObjectURL(selectedAvatarPreviewUrl);
    }

    const resolvedMimeType = resolveMediaMimeType(file);
    const shouldShowPreviewConversion =
      resolvedMimeType === "image/heic" || resolvedMimeType === "image/heif";

    const selectionId = ++avatarPreviewSelectionRef.current;
    setIsPreviewConverting(shouldShowPreviewConversion);
    const previewUrl = createInstantPreviewUrl(file, (upgradedPreviewUrl) => {
      if (avatarPreviewSelectionRef.current !== selectionId) {
        URL.revokeObjectURL(upgradedPreviewUrl);
        return;
      }

      setSelectedAvatarPreviewUrl((currentPreviewUrl) => {
        if (currentPreviewUrl) {
          URL.revokeObjectURL(currentPreviewUrl);
        }
        return upgradedPreviewUrl;
      });
      setIsPreviewConverting(false);
    }, () => {
      if (avatarPreviewSelectionRef.current !== selectionId) {
        return;
      }
      setIsPreviewConverting(false);
    });

    setSelectedAvatarFile(file);
    setSelectedAvatarPreviewUrl(previewUrl);
    setUploadProgress(0);
  };

  const handleRemoveAvatar = () => {
    avatarPreviewSelectionRef.current += 1;

    if (selectedAvatarPreviewUrl) {
      URL.revokeObjectURL(selectedAvatarPreviewUrl);
    }

    setSelectedAvatarFile(null);
    setSelectedAvatarPreviewUrl(null);
    setUploadProgress(0);
    setIsPreviewConverting(false);
    setForm((prev) => ({ ...prev, avatarUrl: "" }));
  };

  const handleSave = async () => {
    if (isSaving) return;
    setSaveError(null);

    if (!familyId) {
      setSaveError("Unable to update profile without an active family context.");
      return;
    }

    const trimmedName = form.name.trim();
    if (trimmedName.length === 0) {
      setSaveError("Name is required.");
      return;
    }

    setIsSaving(true);

    try {
      let nextAvatarUrl = form.avatarUrl.trim();

      if (selectedAvatarFile) {
        const compressedAvatarFile = await compressImage(selectedAvatarFile, setUploadProgress);
        setUploadProgress(0);

        const intentsResponse = await fetch("/api/uploads/intent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            familyId,
            uploadFor: "avatar",
            memberId: member.id,
            files: [
              {
                fileName: compressedAvatarFile.name,
                mimeType: compressedAvatarFile.type,
                sizeBytes: compressedAvatarFile.size,
              },
            ],
          }),
        });

        const intentBody = (await intentsResponse.json()) as {
          intents?: UploadIntentItem[];
          error?: { message?: string };
        };

        if (!intentsResponse.ok || !intentBody.intents?.[0]) {
          throw new Error(intentBody.error?.message ?? "Failed to create avatar upload intent.");
        }

        const avatarIntent = intentBody.intents[0];
        await uploadFileWithProgress(
          avatarIntent.uploadUrl,
          compressedAvatarFile,
          avatarIntent.requiredHeaders,
          setUploadProgress,
        );

        nextAvatarUrl = avatarIntent.readUrl;
      }

      await updateProfile.mutateAsync({
        familyId,
        memberId: member.id,
        name: trimmedName,
        image: nextAvatarUrl.length > 0 ? nextAvatarUrl : null,
      });

      await Promise.all([
        trpcUtils.familyMember.getCurrentUserMemberProfile.invalidate(),
        trpcUtils.familyMember.getMemberProfileBySlug.invalidate(),
        trpcUtils.familyMember.listFamilyMembers.invalidate(),
      ]);

      setIsSaving(false);
      setOpen(false);
    } catch (error) {
      setSaveError(getUploadErrorMessage(error));
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {triggerText}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/55 p-3 sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Edit profile"
          onClick={closeDialog}
        >
          <div
            className="w-full max-w-xl rounded-3xl border border-border/80 bg-card p-4 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-xl tracking-tight">Edit profile</h2>
                <p className="mt-1 text-muted-foreground text-sm">Update the member name and avatar.</p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={closeDialog}
                aria-label="Close edit profile dialog"
              >
                <X className="size-4" />
              </Button>
            </header>

            <div className="mt-4 space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="hidden"
                onChange={(event) => {
                  handleAvatarSelected(event.currentTarget.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
              />

              <div className="flex items-center gap-3 rounded-2xl border bg-muted/20 p-3">
                <div className="relative shrink-0">
                  <Avatar className="size-14 border">
                    <AvatarImage src={avatarPreviewUrl || undefined} alt={form.name || member.name} />
                    <AvatarFallback className="text-sm font-semibold text-foreground">
                      {previewInitials}
                    </AvatarFallback>
                  </Avatar>
                  {isPreviewConverting ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background">
                      <Loader className="size-4 animate-spin text-foreground" aria-hidden="true" />
                      <span className="sr-only">Converting image preview</span>
                    </div>
                  ) : null}
                </div>

                {/* <div className="min-w-0">
                  <p className="font-medium text-sm">Live preview</p>
                  <p className="truncate text-muted-foreground text-xs">{form.name || member.name}</p>
                </div> */}

                <div className="ml-auto flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSaving}
                  >
                    <Camera className="size-4" aria-hidden="true" />
                    Choose image
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleRemoveAvatar}
                    disabled={isSaving || (!avatarPreviewUrl && !selectedAvatarFile)}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              {selectedAvatarFile ? (
                <p className="text-muted-foreground text-xs">Selected image: {selectedAvatarFile.name}</p>
              ) : null}

              {isSaving && uploadProgress > 0 ? (
                <div className="space-y-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">Uploading avatar: {uploadProgress}%</p>
                </div>
              ) : null}

              <label className="space-y-1.5 text-sm">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
                  <User className="size-3.5" aria-hidden="true" />
                  Full name
                </span>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Enter full name"
                />
              </label>

              {saveError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                >
                  {saveError}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2 mt-4">
                <Button type="button" variant="ghost" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || form.name.trim().length === 0}
                >
                  {isSaving ? (
                    <>
                      <Loader className="size-4 animate-spin" aria-hidden="true" />
                      Saving...
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
