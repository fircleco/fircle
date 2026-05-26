"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { AlertCircle, Camera, Loader } from "~/components/ui/icons";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";

type UploadIntentItem = {
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  readUrl: string;
};

const ACCEPTED_FAMILY_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_FAMILY_IMAGE_BYTES = 15 * 1024 * 1024;

const managementContextSchema = z.object({
  family: z
    .object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      image: z.string().nullable(),
    })
    .nullable(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]).nullable(),
  canManageInvites: z.boolean(),
});

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
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
      reject(new Error("Network error while uploading family image. Please try again."));
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

export default function FamilySettingsPage() {
  const [familyName, setFamilyName] = useState("");
  const [familyDescription, setFamilyDescription] = useState("");
  const [familyImageUrl, setFamilyImageUrl] = useState("");
  const [selectedFamilyImageFile, setSelectedFamilyImageFile] = useState<File | null>(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const parsedManagementContext = useMemo(
    () => managementContextSchema.safeParse(managementContext.data as unknown),
    [managementContext.data],
  );

  const managementContextData = parsedManagementContext.success
    ? parsedManagementContext.data
    : null;

  const updateFamilyIdentity = api.invite.updateFamilyIdentity.useMutation();
  const trpcUtils = api.useUtils();

  const familyId = managementContextData?.family?.id;
  const canManageFamilyIdentity =
    managementContextData?.role === "ADMIN" || managementContextData?.role === "OWNER";
  const previewImage = selectedImagePreviewUrl ?? familyImageUrl;
  const previewName = familyName.trim().length > 0 ? familyName : "Family";

  useEffect(() => {
    const family = managementContextData?.family;
    if (!family) {
      return;
    }

    setFamilyName(family.name);
    setFamilyDescription(family.description ?? "");
    setFamilyImageUrl(family.image ?? "");
    setSaveError(null);
  }, [managementContextData?.family]);

  useEffect(() => {
    return () => {
      if (selectedImagePreviewUrl) {
        URL.revokeObjectURL(selectedImagePreviewUrl);
      }
    };
  }, [selectedImagePreviewUrl]);

  function handleImageSelected(file: File | null) {
    if (!file) {
      return;
    }

    setSaveError(null);
    setSaveSuccess(null);

    if (!ACCEPTED_FAMILY_IMAGE_MIME_TYPES.has(file.type)) {
      setSaveError("Please select a supported image format (jpg, png, webp, heic, heif).");
      return;
    }

    if (file.size > MAX_FAMILY_IMAGE_BYTES) {
      setSaveError("Family image exceeds the 15MB size limit.");
      return;
    }

    if (selectedImagePreviewUrl) {
      URL.revokeObjectURL(selectedImagePreviewUrl);
    }

    setSelectedFamilyImageFile(file);
    setSelectedImagePreviewUrl(URL.createObjectURL(file));
    setUploadProgress(0);
  }

  function handleRemoveImage() {
    if (selectedImagePreviewUrl) {
      URL.revokeObjectURL(selectedImagePreviewUrl);
    }

    setSelectedFamilyImageFile(null);
    setSelectedImagePreviewUrl(null);
    setUploadProgress(0);
    setFamilyImageUrl("");
    setSaveError(null);
    setSaveSuccess(null);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    if (!familyId) {
      setSaveError("No active family context found.");
      return;
    }

    if (!canManageFamilyIdentity) {
      setSaveError("You do not have permission to update family identity.");
      return;
    }

    const normalizedFamilyName = familyName.trim();
    const normalizedFamilyDescription = familyDescription.trim();
    if (normalizedFamilyName.length === 0) {
      setSaveError("Family name is required.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      let nextFamilyImageUrl = familyImageUrl.trim();

      if (selectedFamilyImageFile) {
        const intentsResponse = await fetch("/api/uploads/intent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            familyId,
            uploadFor: "family-image",
            files: [
              {
                fileName: selectedFamilyImageFile.name,
                mimeType: selectedFamilyImageFile.type,
                sizeBytes: selectedFamilyImageFile.size,
              },
            ],
          }),
        });

        const intentBody = (await intentsResponse.json()) as {
          intents?: UploadIntentItem[];
          error?: { message?: string };
        };

        if (!intentsResponse.ok || !intentBody.intents?.[0]) {
          throw new Error(intentBody.error?.message ?? "Failed to create family image upload intent.");
        }

        const imageIntent = intentBody.intents[0];
        await uploadFileWithProgress(
          imageIntent.uploadUrl,
          selectedFamilyImageFile,
          imageIntent.requiredHeaders,
          setUploadProgress,
        );

        nextFamilyImageUrl = imageIntent.readUrl;
      }

      await updateFamilyIdentity.mutateAsync({
        familyId,
        name: normalizedFamilyName,
        description:
          normalizedFamilyDescription.length > 0 ? normalizedFamilyDescription : null,
        image: nextFamilyImageUrl.length > 0 ? nextFamilyImageUrl : null,
      });

      await trpcUtils.invite.getManagementContext.invalidate();

      if (selectedImagePreviewUrl) {
        URL.revokeObjectURL(selectedImagePreviewUrl);
      }

      setSelectedFamilyImageFile(null);
      setSelectedImagePreviewUrl(null);
      setUploadProgress(0);
      setFamilyImageUrl(nextFamilyImageUrl);
      setSaveSuccess("Family identity updated.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to update family identity.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h2 className="font-semibold text-xl tracking-tight">Family Settings</h2>
        <p className="text-muted-foreground text-sm">Manage family name and family image.</p>
      </header>

      {managementContext.isLoading ? (
        <FamilySettingsSkeleton />
      ) : null}

      {!managementContext.isLoading && !familyId ? (
        <Alert>
          <AlertCircle className="size-5" aria-hidden="true" />
          <AlertTitle>No active family found</AlertTitle>
          <AlertDescription>Join a family before editing family identity.</AlertDescription>
        </Alert>
      ) : null}

      {!managementContext.isLoading && familyId && !canManageFamilyIdentity ? (
        <Alert>
          <AlertCircle className="size-5" aria-hidden="true" />
          <AlertTitle>Permission required</AlertTitle>
          <AlertDescription>Only owners and admins can manage family identity.</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-5 rounded-2xl border bg-card/60 p-5">
        <h3 className="font-medium text-base">Family Identity</h3>

        <form onSubmit={handleSave} className="space-y-4" noValidate>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={(event) => {
              handleImageSelected(event.currentTarget.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />

          <div className="flex items-center gap-3 rounded-2xl border bg-muted/20 p-3">
            <Avatar className="size-14 shrink-0 border">
              <AvatarImage src={previewImage || undefined} alt={previewName} />
              <AvatarFallback className="text-sm font-semibold text-foreground">
                {getInitials(previewName) || "FM"}
              </AvatarFallback>
            </Avatar>

            {/* <div className="min-w-0">
              <p className="font-medium text-sm">Live preview</p>
              <p className="truncate text-muted-foreground text-xs">{previewName}</p>
            </div> */}

            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving || !canManageFamilyIdentity || !familyId}
              >
                <Camera className="size-4" aria-hidden="true" />
                Choose image
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleRemoveImage}
                disabled={isSaving || !canManageFamilyIdentity || !familyId || (!previewImage && !selectedFamilyImageFile)}
              >
                Remove
              </Button>
            </div>
          </div>

          {selectedFamilyImageFile ? (
            <p className="text-muted-foreground text-xs">Selected image: {selectedFamilyImageFile.name}</p>
          ) : null}

          {isSaving && uploadProgress > 0 ? (
            <div className="space-y-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-muted-foreground text-xs">Uploading image: {uploadProgress}%</p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="family-name" className="text-sm font-medium">
              Family name
            </label>
            <Input
              id="family-name"
              value={familyName}
              onChange={(event) => {
                setFamilyName(event.target.value);
                setSaveError(null);
                setSaveSuccess(null);
              }}
              placeholder="e.g. The Walker Family"
              disabled={isSaving || !canManageFamilyIdentity || !familyId}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="family-description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="family-description"
              value={familyDescription}
              onChange={(event) => {
                setFamilyDescription(event.target.value);
                setSaveError(null);
                setSaveSuccess(null);
              }}
              placeholder="Optional short description for your family"
              className="block min-h-18 w-full rounded-2xl border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
              maxLength={500}
              disabled={isSaving || !canManageFamilyIdentity || !familyId}
            />
            <p className="text-muted-foreground text-xs">{familyDescription.length}/500</p>
          </div>

          {saveError ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {saveError}
            </p>
          ) : null}

          {saveSuccess ? (
            <p role="status" aria-live="polite" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
              {saveSuccess}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={
              isSaving ||
              !canManageFamilyIdentity ||
              !familyId ||
              familyName.trim().length === 0
            }
          >
            {isSaving ? (
              <>
                <Loader className="size-4 animate-spin" aria-hidden="true" />
                Saving...
              </>
            ) : (
              "Save family identity"
            )}
          </Button>
        </form>
      </section>

      {/* Invite Policy - MOCK - DON NOT REMOVE */}
      {/* <section className="space-y-4 rounded-2xl border bg-card/60 p-5">
        <div className="space-y-0.5">
          <h3 className="font-medium text-base">Invite Policy</h3>
          <p className="text-muted-foreground text-xs">
            Controls which members can generate invite links for new family members.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="sr-only">Who can send invites?</legend>
          <p className="text-sm font-medium">Who can send invites?</p>
          {(
            [
              { value: "admin_only", label: "Admins only" },
              { value: "any_member", label: "Any member" },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                invitePolicy === option.value
                  ? "border-primary/60 bg-primary/5 text-foreground"
                  : "border-border bg-background hover:bg-muted/60",
              )}
            >
              <input
                type="radio"
                name="invite-policy"
                value={option.value}
                checked={invitePolicy === option.value}
                onChange={() => setInvitePolicy(option.value)}
                className="accent-primary"
              />
              {option.label}
            </label>
          ))}
        </fieldset>

        <Button
          type="button"
          disabled={isSaving}
          onClick={() => {
            setIsSaving(true);
            setTimeout(() => setIsSaving(false), 1200);
          }}
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </section> */}

      {/* Danger Zone - MOCK - DO NOT REMOVE */}
      {/* <section className="space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="space-y-0.5">
            <h3 className="font-medium text-base text-destructive">Danger Zone</h3>
            <p className="text-muted-foreground text-xs">
              Destructive actions cannot be undone. Contact the family owner to proceed.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          disabled
          title="Contact family owner to perform this action."
          className="border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          Reset family data
        </Button>
      </section> */}
    </div>
  );
}

function FamilySettingsSkeleton() {
  return (
    <section className="space-y-5 rounded-2xl border bg-card/60 p-5" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-5 w-40 rounded-full" />
        <Skeleton className="h-3.5 w-72 max-w-full rounded-full" />
      </div>

      <div className="space-y-4 rounded-2xl border bg-background p-4">
        <div className="flex items-center gap-3 rounded-2xl border bg-muted/20 p-3">
          <Skeleton className="size-14 shrink-0 rounded-full border" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3.5 w-24 rounded-full" />
            <Skeleton className="h-3 w-36 rounded-full" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-10 w-full rounded-2xl" />
        </div>

        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-2.5 w-24 rounded-full" />
        </div>

        <Skeleton className="h-9 w-40 rounded-full" />
      </div>
    </section>
  );
}
